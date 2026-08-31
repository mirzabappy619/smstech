const PDFDocument = require('pdfkit');

interface PackingSlipItem {
	name: string;
	variation_name: string | null;
	// order_items carries a serial number for tracked devices; there is no sku
	// column, so the SKU cell falls back to it.
	sku?: string | null;
	serial_number?: string | null;
	quantity: number;
}

interface PackingSlipOrder {
	order_number: string;
	created_at: string;
	shipping_address: {
		name?: string;
		first_name?: string;
		last_name?: string;
		address_line1: string;
		address_line2?: string | null;
		city: string;
		state?: string;
		postal_code?: string;
		country?: string;
		phone?: string | null;
	} | null;
	items: PackingSlipItem[];
}

export function generatePackingSlipPdf(
	order: PackingSlipOrder
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 50, size: 'A4' });
		const chunks: Buffer[] = [];

		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		// ── HEADER ──────────────────────────────────────────────────────────
		doc.fontSize(28)
			.font('Helvetica-Bold')
			.fillColor('#111')
			.text('PACKING SLIP', 50, 50);

		doc.fontSize(16)
			.font('Helvetica-Bold')
			.fillColor('#333')
			.text(`Order #${order.order_number}`, 50, 90);

		doc.fontSize(10)
			.font('Helvetica')
			.fillColor('#666')
			.text(
				`Date: ${new Date(order.created_at).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})}`,
				50,
				112
			);

		// Horizontal rule
		doc.moveTo(50, 135).lineTo(545, 135).strokeColor('#e5e7eb').lineWidth(1).stroke();

		// ── SHIP TO ─────────────────────────────────────────────────────────
		doc.fontSize(10).font('Helvetica-Bold').fillColor('#111').text('SHIP TO', 50, 155);

		const addr = order.shipping_address;
		doc.font('Helvetica').fillColor('#333').fontSize(9);

		if (addr) {
			doc.text(
				addr.name || `${addr.first_name ?? ''} ${addr.last_name ?? ''}`.trim(),
				50,
				171,
			);
			doc.text(addr.address_line1, 50, 184);
			if (addr.address_line2) {
				doc.text(addr.address_line2, 50, 197);
				doc.text(`${addr.city}, ${addr.state ?? ''} ${addr.postal_code ?? ''}`.trim(), 50, 210);
			} else {
				doc.text(`${addr.city}, ${addr.state ?? ''} ${addr.postal_code ?? ''}`.trim(), 50, 197);
			}
			doc.text(addr.country ?? '', 50, addr.address_line2 ? 223 : 210);
			if (addr.phone) {
				doc.text(addr.phone, 50, addr.address_line2 ? 236 : 223);
			}
		}

		// ── ITEMS TABLE ──────────────────────────────────────────────────────
		const tableTop = 280;
		const col = { checkbox: 55, item: 90, sku: 280, qty: 420 };

		// Table header background
		doc.rect(50, tableTop, 495, 20).fill('#f3f4f6');
		doc.fontSize(9)
			.font('Helvetica-Bold')
			.fillColor('#111')
			.text('☐', col.checkbox, tableTop + 5)
			.text('ITEM', col.item, tableTop + 5)
			.text('SKU', col.sku, tableTop + 5)
			.text('QTY', col.qty, tableTop + 5);

		let y = tableTop + 25;
		doc.font('Helvetica').fillColor('#333');

		order.items.forEach((item, i) => {
			const itemHeight = item.variation_name ? 28 : 20;
			if (i % 2 === 0) doc.rect(50, y - 3, 495, itemHeight).fill('#fafafa');

			// Checkbox
			doc.fontSize(9).rect(col.checkbox - 5, y, 12, 12).stroke();

			// Item name and details
			doc.fontSize(9)
				.fillColor('#333')
				.text(item.name, col.item, y, { width: 185 })
				.fontSize(8)
				.fillColor('#666');

			if (item.variation_name) {
				doc.text(item.variation_name, col.item, y + 11, { width: 185 });
			}

			doc.fontSize(9)
				.fillColor('#333')
				.text(item.sku || item.serial_number || '—', col.sku, y)
				.text(String(item.quantity), col.qty, y);

			y += itemHeight;
		});

		// ── FOOTER ───────────────────────────────────────────────────────────
		const footerY = 720;
		doc.moveTo(50, footerY)
			.lineTo(545, footerY)
			.strokeColor('#e5e7eb')
			.lineWidth(1)
			.stroke();

		doc.fontSize(9)
			.font('Helvetica-Bold')
			.fillColor('#333')
			.text(`Total Items: ${order.items.reduce((sum, i) => sum + i.quantity, 0)}`, 50, footerY + 15);

		doc.fontSize(8)
			.font('Helvetica')
			.fillColor('#666')
			.text('Packed by: _____________________     Date: _____________________', 50, footerY + 35);

		doc.end();
	});
}
