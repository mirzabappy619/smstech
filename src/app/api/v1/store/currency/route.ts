import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { readStoreSettings } from '@/lib/store-settings';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

const CURRENCY_SYMBOLS: Record<string, string> = {
	USD: '$',
	EUR: '€',
	GBP: '£',
	BDT: '৳',
	INR: '₹',
	JPY: '¥',
	CAD: 'CA$',
	AUD: 'A$',
	SGD: 'S$',
	AED: 'د.إ',
};

export async function GET(_request: NextRequest) {
	try {
		const supabase = await createServerClient();
		const settings = await readStoreSettings(supabase);

		const currency_code = settings.store_currency || 'USD';
		const currency_symbol = CURRENCY_SYMBOLS[currency_code] || currency_code;

		return jsonResponse({
			currency_code,
			currency_symbol,
		});
	} catch (error) {
		console.error('Error fetching currency:', error);
		return errorResponse('CURRENCY_FETCH_FAILED', 'Failed to fetch currency', 500);
	}
}
