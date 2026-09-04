import { describe, it, expect } from 'vitest'
import {
	DEFAULT_CURRENCY,
	currencySymbol,
	formatCurrency,
	formatBDT,
	formatCurrencyForPdf,
} from '@/lib/currency'

describe('currency formatting', () => {
	it('defaults to Taka', () => {
		expect(DEFAULT_CURRENCY).toBe('BDT')
		expect(formatCurrency(1000)).toBe('৳1,000')
	})

	it('renders Taka with the ৳ sign, not the ISO code', () => {
		expect(formatBDT(95000)).toBe('৳95,000')
		expect(formatBDT(95000)).not.toContain('BDT')
		expect(formatBDT(95000)).not.toContain('$')
	})

	it('rounds Taka to whole units', () => {
		expect(formatBDT(1234.56)).toBe('৳1,235')
		expect(formatBDT(0.4)).toBe('৳0')
	})

	it('treats null, undefined and NaN as zero', () => {
		expect(formatBDT(null)).toBe('৳0')
		expect(formatBDT(undefined)).toBe('৳0')
		expect(formatBDT(NaN)).toBe('৳0')
	})

	it('still formats other currencies through Intl', () => {
		expect(formatCurrency(1000, 'USD')).toBe('$1,000')
		expect(formatCurrency(1000, 'EUR')).toBe('€1,000')
	})

	it('is case-insensitive about the currency code', () => {
		expect(formatCurrency(500, 'bdt')).toBe('৳500')
	})

	it('falls back to the code itself for unknown currencies', () => {
		expect(currencySymbol('XYZ')).toBe('XYZ')
		// Intl accepts any well-formed 3-letter code and separates with U+00A0.
		expect(formatCurrency(500, 'XYZ').replace(/\u00a0/g, ' ')).toBe('XYZ 500')
	})

	it('survives a malformed currency code', () => {
		expect(formatCurrency(500, 'not-a-code')).toBe('NOT-A-CODE 500')
	})

	it('exposes the right symbols', () => {
		expect(currencySymbol('BDT')).toBe('৳')
		expect(currencySymbol()).toBe('৳')
		expect(currencySymbol('USD')).toBe('$')
	})

	// PDFKit's built-in Helvetica cannot encode U+09F3.
	it('spells the code out for PDF output', () => {
		expect(formatCurrencyForPdf(95000)).toBe('BDT 95,000')
		expect(formatCurrencyForPdf(95000)).not.toContain('৳')
	})
})
