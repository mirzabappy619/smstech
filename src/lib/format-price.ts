import { formatCurrency } from './currency';

/**
 * Shared price formatting utility — BDT (Bangladeshi Taka)
 * Delegates to formatCurrency for consistency.
 *
 * Usage:
 *   formatPrice(1999.99)  → "৳2,000"
 *   formatPrice(0)        → "৳0"
 *
 * @deprecated Use formatCurrency(amount, code) directly for dynamic currency.
 *             Or use useCurrency().format() in storefront components.
 */
export function formatPrice(amount: number | null | undefined): string {
	return formatCurrency(amount, 'BDT');
}
