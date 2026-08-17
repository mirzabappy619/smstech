const PDFDocument = require('pdfkit');

interface InvoiceOrderItem {
	name: string;
	variation_name: string | null;
	sku: string;
	quantity: number;
	unit_price: number;
	total_price: number;
}

interface InvoiceOrder {
	order_number: string;
	created_at: string;
	payment_method: string | null;
	customer: {
		first_name: string;
		last_name: string;
		email: string;
		phone?: string;
	} | null;
	shipping_address: {
		name?: string;
		first_name: string;
		last_name: string;
		address_line1: string;
		address_line2?: string | null;
		city: string;
		state: string;
		postal_code: string;
		country: string;
		phone?: string;
		email?: string;
	} | null;
	items: InvoiceOrderItem[];
	subtotal: number;
	tax_amount: number;
	shipping_amount: number;
	discount_amount: number;
	total_amount: number;
	currency: string;
}

interface StoreInfo {
	store_name: string;
	store_address: string;
	store_email: string;
	store_phone: string;
}

/**
 * Sanitizes and cleans text so PDFKit Helvetica font never crashes or renders broken box glyphs.
 */
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
		const doc = new PDFDocument({ margin: 50, size: 'A4' });
		const chunks: Buffer[] = [];

		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		// Format currency explicitly in BDT (Bangladeshi Taka)
		const fmt = (amount: number) => {
			const val = Math.round(Number(amount || 0));
			return `BDT ${val.toLocaleString('en-US')}`;
		};

		// ── HEADER ──────────────────────────────────────────────────────────
		doc.fontSize(22).font('Helvetica-Bold').text(cleanPdfText(store.store_name || 'Gizmo Gadgets'), 50, 50);
		doc.fontSize(9)
			.font('Helvetica')
			.fillColor('#666')
			.text(cleanPdfText(store.store_address || 'Dhaka, Bangladesh'), 50, 78)
			.text(cleanPdfText(store.store_email || 'support@gizmogadgets.com'), 50, 90)
			.text(cleanPdfText(store.store_phone || ''), 50, 102);

		// Invoice title block (right-aligned)
		doc.fontSize(26)
			.font('Helvetica-Bold')
			.fillColor('#111')
			.text('INVOICE', 380, 50, { width: 165, align: 'right' });

		doc.fontSize(9)
			.font('Helvetica')
			.fillColor('#666')
			.text(`Invoice #: ${cleanPdfText(order.order_number)}`, 380, 84, { width: 165, align: 'right' })
			.text(
				`Date: ${new Date(order.created_at).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				})}`,
				380,
				96,
				{ width: 165, align: 'right' }
			);

		// Horizontal rule
		doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e5e7eb').lineWidth(1).stroke();

		// ── BILL TO ─────────────────────────────────────────────────────────
		doc.fontSize(9).font('Helvetica-Bold').fillColor('#111').text('BILL TO', 50, 135);

		const addr = order.shipping_address;
		const customer = order.customer;

		const customerName = cleanPdfText(
			customer
				? `${customer.first_name || ''} ${customer.last_name || ''}`
				: addr?.name || `${addr?.first_name || ''} ${addr?.last_name || ''}` || 'Customer'
		);
		const customerEmail = cleanPdfText(customer?.email || addr?.email || '');
		const customerPhone = cleanPdfText(customer?.phone || addr?.phone || '');

		doc.font('Helvetica').fillColor('#333');
		let yPos = 148;

		if (customerName) {
			doc.font('Helvetica-Bold').text(customerName, 50, yPos);
			yPos += 12;
		}

		doc.font('Helvetica');
		if (addr) {
			if (addr.address_line1) {
				doc.text(cleanPdfText(addr.address_line1), 50, yPos);
				yPos += 11;
			}
			if (addr.address_line2) {
				doc.text(cleanPdfText(addr.address_line2), 50, yPos);
				yPos += 11;
			}
			const locStr = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ');
			if (locStr) {
				doc.text(cleanPdfText(locStr), 50, yPos);
				yPos += 11;
			}
		}

		if (customerPhone) {
			doc.text(`Phone: ${customerPhone}`, 50, yPos);
			yPos += 11;
		}
		if (customerEmail) {
			doc.text(`Email: ${customerEmail}`, 50, yPos);
			yPos += 11;
		}

		doc.font('Helvetica-Bold').text('PAYMENT METHOD', 380, 135, { width: 165, align: 'right' });
		doc.font('Helvetica')
			.fillColor('#555')
			.text((order.payment_method || 'Cash on Delivery').toUpperCase().replace(/_/g, ' '), 380, 148, {
				width: 165,
				align: 'right',
			});

		// ── ITEMS TABLE ──────────────────────────────────────────────────────
		const tableTop = Math.max(yPos + 15, 230);
		const col = { item: 50, qty: 310, unit: 370, total: 460 };

		// Table header background
		doc.rect(50, tableTop, 495, 20).fill('#f3f4f6');
		doc.fontSize(9)
			.font('Helvetica-Bold')
			.fillColor('#111')
			.text('ITEM', col.item, tableTop + 5)
			.text('QTY', col.qty, tableTop + 5)
			.text('UNIT PRICE', col.unit, tableTop + 5)
			.text('TOTAL', col.total, tableTop + 5, { width: 85, align: 'right' });

		let y = tableTop + 25;
		doc.font('Helvetica').fillColor('#333');

		(order.items || []).forEach((item, i) => {
			const itemHeight = item.variation_name ? 28 : 20;
			if (i % 2 === 0) doc.rect(50, y - 3, 495, itemHeight).fill('#fafafa');

			doc.fillColor('#333')
				.text(cleanPdfText(item.name || 'Product Item'), col.item, y, { width: 250 })
				.fontSize(8)
				.fillColor('#666');

			if (item.variation_name) {
				doc.text(cleanPdfText(item.variation_name), col.item, y + 11, { width: 250 });
			}

			doc.fontSize(9)
				.fillColor('#333')
				.text(String(item.quantity || 1), col.qty, y)
				.text(fmt(item.unit_price || 0), col.unit, y)
				.text(fmt(item.total_price || 0), col.total, y, { width: 85, align: 'right' });

			y += itemHeight;
		});

		// ── TOTALS ───────────────────────────────────────────────────────────
		y += 10;
		doc.moveTo(50, y)
			.lineTo(545, y)
			.strokeColor('#e5e7eb')
			.lineWidth(0.5)
			.stroke();
		y += 10;

		const addTotalLine = (label: string, value: string, bold = false) => {
			doc.fontSize(9)
				.font(bold ? 'Helvetica-Bold' : 'Helvetica')
				.fillColor('#333')
				.text(label, 330, y, { width: 130, align: 'right' })
				.text(value, col.total, y, { width: 85, align: 'right' });
			y += 16;
		};

		addTotalLine('Subtotal', fmt(order.subtotal || 0));
		addTotalLine('Shipping', fmt(order.shipping_amount || 0));
		if (order.tax_amount && order.tax_amount > 0) {
			addTotalLine('Tax', fmt(order.tax_amount));
		}
		if (order.discount_amount && order.discount_amount > 0) {
			addTotalLine('Discount', `-${fmt(order.discount_amount)}`);
		}

		y += 4;
		doc.moveTo(330, y)
			.lineTo(545, y)
			.strokeColor('#111')
			.lineWidth(0.5)
			.stroke();
		y += 8;
		addTotalLine('TOTAL (BDT)', fmt(order.total_amount || 0), true);

		// ── FOOTER ───────────────────────────────────────────────────────────
		doc.fontSize(9)
			.font('Helvetica')
			.fillColor('#888')
			.text('Thank you for shopping with Gizmo Gadgets!', 50, 750, {
				align: 'center',
				width: 495,
			});

		doc.end();
	});
}
