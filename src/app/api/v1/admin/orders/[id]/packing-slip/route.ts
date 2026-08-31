import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, errorResponse } from '@/lib/api-utils';
import { generatePackingSlipPdf } from '@/lib/pdf/packing-slip';

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
		.select('id, product_name, variation_name, quantity, serial_number')
		.eq('order_id', orderId);

	if (itemsError) {
		return errorResponse('ITEMS_FETCH_FAILED', 'Failed to fetch order items', 500);
	}

	// Format items for PDF
	const formattedItems = (items || []).map((item: any) => ({
		name: item.product_name,
		variation_name: item.variation_name || null,
		serial_number: item.serial_number,
		quantity: item.quantity,
	}));

	try {
		const pdfBuffer = await generatePackingSlipPdf({
			order_number: order.order_number,
			created_at: order.created_at,
			shipping_address: {
				name: order.customer_name || '',
				address_line1: order.address_line1 || '',
				city: order.city || '',
				phone: order.customer_phone || '',
			},
			items: formattedItems,
		});

		return new NextResponse(new Uint8Array(pdfBuffer), {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="packing-slip-${order.order_number}.pdf"`,
				'Content-Length': String(pdfBuffer.length),
			},
		});
	} catch (error) {
		console.error('Error generating packing slip PDF:', error);
		return errorResponse('PDF_GENERATION_FAILED', 'Failed to generate packing slip PDF', 500);
	}
}
