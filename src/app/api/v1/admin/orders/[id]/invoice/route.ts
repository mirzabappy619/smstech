import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, errorResponse } from '@/lib/api-utils';
import { generateInvoicePdf } from '@/lib/pdf/invoice';
import { getStoreSettings } from '@/lib/get-store-name';

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
		.select('id, product_name, variation_name, quantity, unit_price, total, serial_number, imei_1, warranty_period')
		.eq('order_id', orderId);

	if (itemsError) {
		return errorResponse('ITEMS_FETCH_FAILED', 'Failed to fetch order items', 500);
	}

	// Orders carry the customer's details directly; there is no user_id column.
	const customer = {
		name: order.customer_name || '',
		email: order.customer_email || '',
		phone: order.customer_phone || '',
	};

	const settings = await getStoreSettings();

	// Format items for PDF
	const formattedItems = (items || []).map((item: any) => ({
		name: item.product_name,
		variation_name: item.variation_name || null,
		quantity: item.quantity,
		unit_price: item.unit_price,
		total_price: item.total,
		serial_number: item.serial_number,
		imei_1: item.imei_1,
		warranty_period: item.warranty_period,
	}));

	try {
		const pdfBuffer = await generateInvoicePdf(
			{
				order_number: order.order_number,
				created_at: order.created_at,
				payment_method: order.payment_method,
				payment_breakdown: order.payment_breakdown || undefined,
				customer,
				shipping_address: {
					name: order.customer_name || '',
					address_line1: order.address_line1 || '',
					city: order.city || '',
					phone: order.customer_phone || '',
					email: order.customer_email || '',
				},
				items: formattedItems,
				subtotal: order.subtotal || 0,
				shipping_amount: order.shipping_amount || 0,
				discount_amount: order.discount_amount || 0,
				advance_deducted: order.advance_deducted || 0,
				due_amount: order.due_amount || 0,
				total: order.total ?? 0,
				currency: settings.store_currency || 'BDT',
			},
			{
				store_name: settings.store_name,
				store_address: settings.store_address,
				store_email: settings.store_email,
				store_phone: settings.store_phone,
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
