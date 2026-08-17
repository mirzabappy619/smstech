'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { formatCurrency } from '@/lib/currency';

interface CurrencyContextValue {
	currencyCode: string;
	currencySymbol: string;
	format: (amount: number | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
	currencyCode: 'USD',
	currencySymbol: '$',
	format: (amount) => formatCurrency(amount, 'USD'),
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
	const [currencyCode, setCurrencyCode] = useState('USD');
	const [currencySymbol, setCurrencySymbol] = useState('$');
	const [_isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		fetch('/api/v1/store/currency')
			.then((r) => r.json())
			.then((data) => {
				if (data.success && data.data) {
					setCurrencyCode(data.data.currency_code);
					setCurrencySymbol(data.data.currency_symbol);
				}
			})
			.catch((err) => {
				console.error('Failed to fetch currency:', err);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	const format = (amount: number | null | undefined) => formatCurrency(amount, currencyCode);

	return (
		<CurrencyContext.Provider value={{ currencyCode, currencySymbol, format }}>
			{children}
		</CurrencyContext.Provider>
	);
}

export function useCurrency() {
	return useContext(CurrencyContext);
}
