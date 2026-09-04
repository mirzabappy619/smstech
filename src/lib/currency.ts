/**
 * Canonical money formatting for the whole app — storefront and admin.
 *
 * The store trades in Bangladeshi Taka, so BDT is the default everywhere and
 * is rendered with the ৳ sign. `Intl` renders BDT as "BDT 1,000" rather than
 * "৳1,000", so BDT is formatted by hand; other currencies still go through
 * `Intl` so a multi-currency store keeps working.
 */

export const DEFAULT_CURRENCY = 'BDT'

export const CURRENCY_SYMBOLS: Record<string, string> = {
	BDT: '৳',
	USD: '$',
	EUR: '€',
	GBP: '£',
	INR: '₹',
	JPY: '¥',
	CAD: 'CA$',
	AUD: 'A$',
	SGD: 'S$',
	AED: 'د.إ',
}

/** The symbol for a currency code, falling back to the code itself. */
export function currencySymbol(currencyCode: string = DEFAULT_CURRENCY): string {
	return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] ?? currencyCode
}

/**
 * Format a monetary amount. Taka amounts are whole numbers by convention, so
 * BDT is rounded and grouped with the en-BD locale.
 */
export function formatCurrency(
	amount: number | null | undefined,
	currencyCode: string = DEFAULT_CURRENCY,
): string {
	const value = amount == null || isNaN(Number(amount)) ? 0 : Number(amount)
	const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase()

	if (code === 'BDT') {
		return `৳${Math.round(value).toLocaleString('en-BD')}`
	}

	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: code,
			maximumFractionDigits: 0,
		}).format(value)
	} catch {
		return `${code} ${Math.round(value).toLocaleString('en-BD')}`
	}
}

/** Shorthand for the common case: an amount in Taka. */
export const formatBDT = (amount: number | null | undefined): string =>
	formatCurrency(amount, 'BDT')

/**
 * PDFKit's built-in Helvetica uses WinAnsi encoding and cannot render ৳
 * (U+09F3), so PDF output spells the code out instead.
 */
export function formatCurrencyForPdf(
	amount: number | null | undefined,
	currencyCode: string = DEFAULT_CURRENCY,
): string {
	const value = amount == null || isNaN(Number(amount)) ? 0 : Number(amount)
	const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase()
	return `${code} ${Math.round(value).toLocaleString('en-BD')}`
}
