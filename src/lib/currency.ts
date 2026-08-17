/**
 * Format a monetary amount using the given ISO 4217 currency code.
 * Falls back to USD if the code is unrecognized.
 */
export function formatCurrency(
	amount: number | null | undefined,
	currencyCode: string = 'USD'
): string {
	if (amount == null || isNaN(amount)) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currencyCode,
		}).format(0);
	}
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currencyCode,
			maximumFractionDigits: 0,
		}).format(amount);
	} catch {
		return `${currencyCode} ${Math.round(amount).toLocaleString()}`;
	}
}
