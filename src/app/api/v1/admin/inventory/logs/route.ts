import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { errorResponse, paginatedResponse, requireAdmin } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
	const { error: authError } = await requireAdmin(request);
	if (authError) return authError;

	const { searchParams } = new URL(request.url);
	const page = parseInt(searchParams.get('page') || '1');
	const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
	const offset = (page - 1) * limit;
	const adjustment_type = searchParams.get('adjustment_type');
	const inventory_id = searchParams.get('inventory_id');
	const date_from = searchParams.get('date_from');
	const date_to = searchParams.get('date_to');

	const supabase = await createAdminClient();

	let query = supabase
		.from('inventory_logs')
		.select(
			`
			id,
			adjustment_type,
			quantity_change,
			quantity_before,
			quantity_after,
			reason,
			order_id,
			user_id,
			metadata,
			created_at,
			inventory:inventory_id (
				id,
				products ( name, sku ),
				product_variations ( name, sku )
			)
			`,
			{ count: 'exact' }
		)
		.order('created_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (adjustment_type) query = query.eq('adjustment_type', adjustment_type);
	if (inventory_id) query = query.eq('inventory_id', inventory_id);
	if (date_from) query = query.gte('created_at', date_from);
	if (date_to) query = query.lte('created_at', date_to);

	const { data, error, count } = await query;

	if (error) {
		console.error('Error fetching logs:', error);
		return errorResponse('LOGS_FETCH_FAILED', 'Failed to fetch logs', 500);
	}

	return paginatedResponse(data || [], page, limit, count || 0);
}
