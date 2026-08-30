/**
 * Pure arithmetic for POS checkout and shift reconciliation.
 *
 * Kept free of database access so the money math can be tested directly, and
 * so the terminal and the API compute totals the same way rather than each
 * carrying its own copy.
 */

export const TENDER_TOLERANCE = 0.01;

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Payment methods the till accepts, and how each maps onto
// payment_transactions.gateway.
export const GATEWAY_BY_METHOD: Record<string, string> = {
	cash: "cash",
	card: "card",
	bkash: "bkash",
	nagad: "nagad",
	advance: "customer_advance",
	prebooking: "customer_advance",
	due: "customer_due",
};

export interface CartLine {
	unit_price: number;
	quantity: number;
}

export interface PaymentLine {
	method: string;
	amount: number;
}

export interface CartTotals {
	subtotal: number;
	discount: number;
	finalTotal: number;
}

/**
 * Line total for one cart row.
 *
 * The order header and the order_items rows must agree, so both derive from
 * this. Previously the subtotal used `Number(qty)` while the line used
 * `Number(qty) || 1`, which let an order total disagree with its own rows.
 */
export function lineTotal(line: CartLine): number {
	return round2(line.unit_price * line.quantity);
}

/**
 * Cart totals. Discount is clamped to the subtotal — a discount larger than
 * the cart used to floor the total at zero while still recording a discount
 * bigger than anything that was sold.
 */
export function computeCartTotals(
	items: CartLine[],
	discountAmount: number,
): CartTotals {
	const subtotal = round2(items.reduce((sum, it) => sum + lineTotal(it), 0));
	const discount = round2(Math.max(0, Math.min(discountAmount || 0, subtotal)));

	return { subtotal, discount, finalTotal: round2(subtotal - discount) };
}

export interface TenderBreakdown {
	totalTendered: number;
	cash: number;
	card: number;
	mobile: number;
	wallet: number;
	advance: number;
	prebooking: number;
	due: number;
	/** Money actually settled now — everything except the due taken on credit. */
	amountSettled: number;
}

export function summarisePayments(payments: PaymentLine[]): TenderBreakdown {
	const sumBy = (predicate: (m: string) => boolean) =>
		round2(
			payments
				.filter((p) => predicate(p.method))
				.reduce((s, p) => s + p.amount, 0),
		);

	const totalTendered = round2(payments.reduce((s, p) => s + p.amount, 0));
	const due = sumBy((m) => m === "due");

	return {
		totalTendered,
		cash: sumBy((m) => m === "cash"),
		card: sumBy((m) => m === "card"),
		mobile: sumBy((m) => m === "bkash" || m === "nagad"),
		wallet: sumBy((m) => m === "advance" || m === "prebooking"),
		advance: sumBy((m) => m === "advance"),
		prebooking: sumBy((m) => m === "prebooking"),
		due,
		amountSettled: round2(totalTendered - due),
	};
}

/** True when the tender matches the invoice to the nearest poisha. */
export function isTenderBalanced(
	totalTendered: number,
	finalTotal: number,
): boolean {
	return Math.abs(totalTendered - finalTotal) <= TENDER_TOLERANCE;
}

export function paymentStatusFor(
	dueAmount: number,
	amountSettled: number,
): "paid" | "partial" | "pending" {
	if (dueAmount <= 0) return "paid";
	return amountSettled > 0 ? "partial" : "pending";
}

/** Change owed when a customer hands over more cash than the cash line. */
export function changeDue(cashGiven: number, cashLineTotal: number): number {
	return round2(Math.max(0, cashGiven - cashLineTotal));
}

export interface CashMovement {
	type: "cash_in" | "cash_out" | "drop" | "float_adjustment";
	amount: number;
}

export interface ShiftCashInputs {
	openingFloat: number;
	cashSales: number;
	duesCollected: number;
	movements: CashMovement[];
}

/**
 * Expected cash in the drawer at close.
 *
 *   opening float + cash sales + dues collected in cash
 *     + cash in − cash out − safe drops
 *
 * Mirrors the shift_expected_cash SQL function. The terminal previously showed
 * `float + cash sales` while the server closed against
 * `float + cash sales + dues collected`, and neither applied cash movements —
 * so a drawer that balanced could still be flagged short.
 */
export function expectedDrawerCash(inputs: ShiftCashInputs): number {
	const movementTotal = inputs.movements.reduce((sum, m) => {
		switch (m.type) {
			case "cash_in":
			case "float_adjustment":
				return sum + m.amount;
			case "cash_out":
			case "drop":
				return sum - m.amount;
			default:
				return sum;
		}
	}, 0);

	return round2(
		inputs.openingFloat +
			inputs.cashSales +
			inputs.duesCollected +
			movementTotal,
	);
}

/**
 * Net position for a customer, used as party_ledgers.balance_after.
 * Positive: they owe us. Negative: we are holding their money.
 */
export function customerNetPosition(
	outstandingDue: number,
	advanceBalance: number,
): number {
	return round2(outstandingDue - advanceBalance);
}

/** Total units moving in a transfer — units, not manifest lines. */
export function transferUnitCount(
	items: { device_unit_id?: string | null; quantity?: number }[],
): number {
	return items.reduce(
		(sum, i) => sum + (i.device_unit_id ? 1 : Number(i.quantity) || 0),
		0,
	);
}
