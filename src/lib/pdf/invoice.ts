const PDFDocument = require('pdfkit');

interface InvoiceOrderItem {
	name: string;
	variation_name?: string | null;
	sku?: string;
	quantity: number;
	unit_price: number;
	total_price?: number;
	total?: number;
	serial_number?: string | null;
	imei_1?: string | null;
	mac_address?: string | null;
	battery_health_pct?: number | null;
	cosmetic_grade?: string | null;
	warranty_period?: string | null;
}

interface InvoiceOrder {
	order_number: string;
	created_at: string;
	payment_method: string | null;
	payment_breakdown?: Array<{ method: string; amount: number; reference?: string }>;
	customer?: {
		first_name?: string;
		last_name?: string;
		name?: string;
		email?: string;
		phone?: string;
	} | null;
	shipping_address?: {
		name?: string;
		first_name?: string;
		last_name?: string;
		address_line1?: string;
		address_line2?: string | null;
		city?: string;
		state?: string;
		postal_code?: string;
		country?: string;
		phone?: string;
		email?: string;
	} | null;
	items: InvoiceOrderItem[];
	subtotal: number;
	tax_amount?: number;
	shipping_amount?: number;
	discount_amount?: number;
	advance_deducted?: number;
	due_amount?: number;
	total_amount?: number;
	total?: number;
	currency?: string;
}

interface StoreInfo {
	store_name: string;
	store_address: string;
	store_email: string;
	store_phone: string;
}

function cleanPdfText(text: string | null | undefined): string {
	if (!text) return '';
	return String(text)
		.replace(/০/g, '0')
		.replace(/১/g, '1')
		.replace(/২/g, '2')
		.replace(/৩/g, '3')
		.replace(/৪/g, '4')
		.replace(/৫/g, '5')
		.replace(/৬/g, '6')
		.replace(/৭/g, '7')
		.replace(/৮/g, '8')
		.replace(/৯/g, '9')
		.replace(/৳/g, 'BDT ')
		.trim();
}

export function generateInvoicePdf(
	order: InvoiceOrder,
	store: StoreInfo
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 40, size: 'A4' });
		const chunks: Buffer[] = [];

		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		const fmt = (amount: number) => {
			const val = Math.round(Number(amount || 0));
			return `BDT ${val.toLocaleString('en-US')}`;
		};

		// ── HEADER & COMPANY BRAND ──────────────────────────────────────────
		doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(cleanPdfText(store.store_name || 'SMSTech Bangladesh'), 40, 40);
		doc.fontSize(8)
			.font('Helvetica')
			.fillColor('#475569')
			.text(cleanPdfText(store.store_address || 'Computer City Center (Multiplan), Level-3, Shop 309, Elephant Road, Dhaka'), 40, 68)
			.text(`Helpline: ${cleanPdfText(store.store_phone || '01781485588')} | Email: ${cleanPdfText(store.store_email || 'support@smstech.bd')}`, 40, 80)
			.text('Web: www.smstech.bd | BIN/Trade: 0029182910-01', 40, 92);

		// Invoice & Certificate Title Box
		doc.rect(360, 40, 195, 65).fill('#f8fafc').strokeColor('#cbd5e1').lineWidth(1).stroke();
		doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('TAX INVOICE & WARRANTY', 365, 48, { width: 185, align: 'center' });
		doc.fontSize(8).font('Helvetica-Bold').fillColor('#2563eb').text(`INVOICE: ${cleanPdfText(order.order_number)}`, 365, 66, { width: 185, align: 'center' });
		doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(
			`Issued: ${new Date(order.created_at || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
			365, 80, { width: 185, align: 'center' }
		);

		// ── BILL TO SECTION ──────────────────────────────────────────────────
		doc.moveTo(40, 115).lineTo(555, 115).strokeColor('#e2e8f0').lineWidth(1).stroke();

		doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('CUSTOMER / BILL TO:', 40, 125);
		const customerName = cleanPdfText(order.customer?.name || `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}` || order.shipping_address?.name || 'Valued Customer');
		const customerPhone = cleanPdfText(order.customer?.phone || order.shipping_address?.phone || 'N/A');
		const customerAddress = cleanPdfText(order.shipping_address?.address_line1 || 'In-Store Counter Delivery');

		doc.fontSize(8).font('Helvetica').fillColor('#334155');
		doc.text(`Name: ${customerName}`, 40, 138);
		doc.text(`Contact: ${customerPhone}`, 40, 149);
		doc.text(`Address: ${customerAddress}`, 40, 160);

		// Payment & Channel Summary
		doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('PAYMENT SUMMARY:', 360, 125);
		doc.fontSize(8).font('Helvetica').fillColor('#334155');
		doc.text(`Payment Tender: ${(order.payment_method || 'Cash / POS Split').toUpperCase().replace(/_/g, ' ')}`, 360, 138);
		if (order.due_amount && order.due_amount > 0) {
			doc.font('Helvetica-Bold').fillColor('#dc2626').text(`Due Balance: ${fmt(order.due_amount)}`, 360, 149);
		} else {
			doc.font('Helvetica-Bold').fillColor('#16a34a').text('Payment Status: FULLY PAID', 360, 149);
		}

		// ── ITEMISED TABLE WITH SERIAL/IMEI & HARDWARE METRICS ────────────────
		const tableTop = 180;
		doc.rect(40, tableTop, 515, 18).fill('#0f172a');
		doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
		doc.text('ITEM DESCRIPTION & SPECIFICATIONS', 48, tableTop + 5);
		doc.text('SERIAL / IMEI / MAC', 270, tableTop + 5);
		doc.text('QTY', 400, tableTop + 5);
		doc.text('UNIT PRICE', 440, tableTop + 5);
		doc.text('TOTAL', 500, tableTop + 5, { width: 50, align: 'right' });

		let y = tableTop + 24;
		const finalTotal = order.total || order.total_amount || 0;

		(order.items || []).forEach((item, i) => {
			const hasSerial = Boolean(item.serial_number || item.imei_1 || item.battery_health_pct);
			const rowHeight = hasSerial ? 34 : 22;

			if (i % 2 === 0) doc.rect(40, y - 3, 515, rowHeight).fill('#f8fafc');

			// Item Title & Specs
			doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(cleanPdfText(item.name), 48, y, { width: 215 });
			doc.font('Helvetica').fontSize(7).fillColor('#64748b');
			if (item.warranty_period) {
				doc.text(`Warranty Coverage: ${cleanPdfText(item.warranty_period)}`, 48, y + 10, { width: 215 });
			}

			// Serial & IMEI
			doc.font('Helvetica-Bold').fontSize(7).fillColor('#2563eb');
			if (item.serial_number) doc.text(`SN: ${cleanPdfText(item.serial_number)}`, 270, y);
			if (item.imei_1) doc.text(`IMEI: ${cleanPdfText(item.imei_1)}`, 270, y + 9);
			if (item.battery_health_pct) {
				doc.font('Helvetica').fontSize(6.5).fillColor('#16a34a').text(`Battery Health: ${item.battery_health_pct}% | Grade: ${cleanPdfText(item.cosmetic_grade || 'A+')}`, 270, y + 18);
			}

			// Qty & Price
			doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
			doc.text(String(item.quantity || 1), 400, y);
			doc.text(fmt(item.unit_price || 0), 440, y);
			doc.font('Helvetica-Bold').text(fmt(item.total_price || item.total || (item.unit_price * item.quantity)), 500, y, { width: 50, align: 'right' });

			y += rowHeight;
		});

		// ── TOTALS BLOCK ─────────────────────────────────────────────────────
		doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
		y += 10;

		const printTotal = (lbl: string, val: string, isBold = false, color = '#0f172a') => {
			doc.fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
			doc.text(lbl, 350, y, { width: 110, align: 'right' });
			doc.text(val, 470, y, { width: 80, align: 'right' });
			y += 12;
		};

		printTotal('Subtotal:', fmt(order.subtotal || finalTotal));
		if (order.discount_amount && order.discount_amount > 0) {
			printTotal('Discount:', `-${fmt(order.discount_amount)}`, false, '#16a34a');
		}
		if (order.advance_deducted && order.advance_deducted > 0) {
			printTotal('Advance Wallet Deducted:', `-${fmt(order.advance_deducted)}`, false, '#2563eb');
		}
		printTotal('NET PAYABLE TOTAL:', fmt(finalTotal), true, '#0f172a');

		if (order.due_amount && order.due_amount > 0) {
			printTotal('OUTSTANDING DUE:', fmt(order.due_amount), true, '#dc2626');
		}

		// ── FORMAL WARRANTY CLAUSES & TERMS CERTIFICATE ──────────────────────
		const warrantyTop = Math.max(y + 10, 490);
		doc.rect(40, warrantyTop, 515, 140).fill('#f1f5f9').strokeColor('#cbd5e1').lineWidth(1).stroke();
		doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('OFFICIAL SMSTECH WARRANTY & REPLACEMENT POLICY', 50, warrantyTop + 8);

		const terms = [
			'1. Warranty Coverage: Certified replacement / service warranty applies strictly to the hardware device serialized above.',
			'2. Battery & Pre-Owned Metrics: Battery health and condition grading disclosed at purchase are guaranteed authentic at intake.',
			'3. Exclusions: Physical damage, liquid ingress, burnt components, screen crack, unauthorized repair, or broken warranty seal sticker void warranty.',
			'4. Warranty Claim: Present this original invoice / certificate and device with unbroken SMSTech seal to any official branch.',
			'5. Dues Settlement: Invoices with unpaid due balance remain collateral of SMSTech BD until full clearance.'
		];

		let termY = warrantyTop + 24;
		doc.font('Helvetica').fontSize(6.8).fillColor('#334155');
		terms.forEach((t) => {
			doc.text(t, 50, termY, { width: 495 });
			termY += 13;
		});

		// ── SIGNATURES & OFFICIAL SEAL ───────────────────────────────────────
		const sigY = 665;
		doc.moveTo(60, sigY).lineTo(200, sigY).strokeColor('#64748b').lineWidth(1).stroke();
		doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text('Customer Signature & Acceptance', 60, sigY + 5, { width: 140, align: 'center' });

		// Official Stamp Graphic Placeholder
		doc.circle(300, sigY - 10, 22).strokeColor('#2563eb').lineWidth(1.5).stroke();
		doc.fontSize(6).font('Helvetica-Bold').fillColor('#2563eb').text('SMSTECH BD\nVERIFIED SEAL', 275, sigY - 16, { width: 50, align: 'center' });

		doc.moveTo(395, sigY).lineTo(535, sigY).strokeColor('#64748b').lineWidth(1).stroke();
		doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text('Authorised Signatory / Branch Manager', 395, sigY + 5, { width: 140, align: 'center' });

		// Document Footer
		doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8').text('This computer-generated tax invoice & warranty certificate is authenticated by SMSTech Enterprise Engine.', 40, 780, { align: 'center', width: 515 });

		doc.end();
	});
}
