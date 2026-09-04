import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { readStoreSettings } from '@/lib/store-settings';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { currencySymbol, DEFAULT_CURRENCY } from '@/lib/currency';


export async function GET(_request: NextRequest) {
	try {
		const supabase = await createServerClient();
		const settings = await readStoreSettings(supabase);

		const currency_code = settings.store_currency || DEFAULT_CURRENCY;
		const currency_symbol = currencySymbol(currency_code);

		return jsonResponse({
			currency_code,
			currency_symbol,
		});
	} catch (error) {
		console.error('Error fetching currency:', error);
		return errorResponse('CURRENCY_FETCH_FAILED', 'Failed to fetch currency', 500);
	}
}
