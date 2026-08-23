import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, errorResponse } from '@/lib/api-utils';
import { generateInvoicePdf } from '@/lib/pdf/invoice';

export const runtime = 'nodejs';

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { error: authError } = await requireAdmin(request);
	if (authError) return authError;

	const { id: orderId } = await params;
	const supabase = await createAdminClient();

	// Fetch order
	const { data: order, error: orderError } = await supabase
		.from('orders')
		.select('*')
		.eq('id', orderId)
		.single();

	if (orderError || !order) {
		return errorResponse('NOT_FOUND', 'Order not found', 404);
	}

	// Fetch order items
	const { data: items, error: itemsError } = await supabase
		.from('order_items')
		.select('id, name, sku, quantity, unit_price, total_price, variation_id, product_variations(name)')
		.eq('order_id', orderId);

	if (itemsError) {
		return errorResponse('ITEMS_FETCH_FAILED', 'Failed to fetch order items', 500);
	}

	// Fetch customer data
	let userData = null;
	if (order.user_id) {
		const { data } = await supabase
			.from('users')
			.select('first_name, last_name, email, phone')
			.eq('id', order.user_id)
			.single();
		userData = data;
	}

	// Fetch store settings
	const { data: settings } = await supabase
		.from('store_settings')
		.select('store_name, store_address, store_email, store_phone')
		.single();

	// Format items for PDF
	const formattedItems = (items || []).map((item: any) => ({
		name: item.name,
		variation_name: item.product_variations?.name || null,
		sku: item.sku,
		quantity: item.quantity,
		unit_price: item.unit_price,
		total_price: item.total_price,
	}));

	try {
		const pdfBuffer = await generateInvoicePdf(
			{
				order_number: order.order_number,
				created_at: order.created_at,
				payment_method: order.payment_method,
				customer: userData,
				shipping_address: order.shipping_address,
				items: formattedItems,
				subtotal: order.subtotal || 0,
				tax_amount: order.tax_amount || 0,
				shipping_amount: order.shipping_amount || 0,
				discount_amount: order.discount_amount || 0,
				total_amount: order.total_amount ?? order.total ?? 0,
				currency: 'BDT',
			},
			{
				store_name: settings?.store_name || 'SMSTech BD',
				store_address: settings?.store_address || '',
				store_email: settings?.store_email || '',
				store_phone: settings?.store_phone || '',
			}
		);

		return new NextResponse(new Uint8Array(pdfBuffer), {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="invoice-${order.order_number}.pdf"`,
				'Content-Length': String(pdfBuffer.length),
			},
		});
	} catch (error) {
		console.error('Error generating invoice PDF:', error);
		return errorResponse('PDF_GENERATION_FAILED', 'Failed to generate invoice PDF', 500);
	}
}
