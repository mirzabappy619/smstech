/**
 * Money moving in the shop's direction and out of it.
 *
 * Three shapes, one set of rules:
 *
 *   sale       goods out, money in     — the customer owes, or pays
 *   purchase   goods in,  money out    — the shop owes, or pays
 *   exchange   both at once            — only the difference actually moves
 *
 * A customer's position is two columns: `outstanding_due` (they owe us) and
 * `advance_balance` (we hold their money). Anything the shop owes a customer
 * settles the due first and only then becomes credit on their account, because
 * paying out cash while the same person still owes on an old invoice is how a
 * debt quietly gets written off.
 */

// `+ 0` collapses -0 to 0: an exchange that settles exactly even produced a
// negative zero, which reaches the UI and the database as "-0".
const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

export type TradePartyType = "supplier" | "customer" | "walk_in";

// Suppliers entered ad-hoc by name share this sentinel party id, so give each
// name its own deterministic bucket rather than collapsing them all into one.
const AD_HOC_SUPPLIER_NAMESPACE = "00000000-0000-0000-0000-0000000000";

/**
 * A stable party id for a supplier typed straight into an intake form. Repeat
 * purchases from the same unregistered name accumulate against one ledger
 * party instead of scattering across the books.
 */
export function adHocSupplierId(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) & 0xff;
	}
	return AD_HOC_SUPPLIER_NAMESPACE + hash.toString(16).padStart(2, "0");
}

/**
 * How money owed *to* a party lands on a customer record.
 * `applied_to_due` clears what they owe; the rest becomes store credit.
 */
export interface CreditApplication {
	applied_to_due: number;
	to_advance: number;
	new_due: number;
	new_advance: number;
}

export function applyCreditToCustomer(
	amount: number,
	outstandingDue: number | string | null | undefined,
	advanceBalance: number | string | null | undefined,
): CreditApplication {
	const credit = round2(Math.max(0, amount));
	const currentDue = round2(Number(outstandingDue) || 0);
	const currentAdvance = round2(Number(advanceBalance) || 0);

	const appliedToDue = round2(Math.min(credit, currentDue));
	const toAdvance = round2(credit - appliedToDue);

	return {
		applied_to_due: appliedToDue,
		to_advance: toAdvance,
		new_due: round2(currentDue - appliedToDue),
		new_advance: round2(currentAdvance + toAdvance),
	};
}

/**
 * Settling a purchase: goods worth `total` received, `paidNow` handed over.
 * Whatever is left is owed to the party.
 */
export interface PurchaseSettlement {
	total: number;
	paid_now: number;
	on_account: number;
}

export function settlePurchase(
	total: number,
	paidNow: number | string | null | undefined,
): { error: string } | { value: PurchaseSettlement } {
	const goods = round2(total);
	if (!Number.isFinite(goods) || goods < 0) {
		return { error: "The value of goods received must be zero or more." };
	}

	// Nothing given means the whole purchase sits on the party's account.
	const paid =
		paidNow === undefined || paidNow === null || paidNow === ""
			? 0
			: round2(Number(paidNow));

	if (!Number.isFinite(paid) || paid < 0) {
		return { error: "Amount paid must be zero or more." };
	}
	if (paid > goods + 0.01) {
		return { error: "Amount paid is more than the goods are worth." };
	}

	const settled = round2(Math.min(paid, goods));
	return {
		value: { total: goods, paid_now: settled, on_account: round2(goods - settled) },
	};
}

/**
 * An exchange nets goods going out against goods coming in. Only the
 * difference is settled, in whichever direction it falls.
 */
export interface ExchangeSettlement {
	goods_out: number;
	trade_in: number;
	/** Positive: the customer still owes. Negative: the shop owes them. */
	net: number;
	/** What the customer hands over now. */
	customer_pays: number;
	/** What is left on the customer's due after this. */
	customer_due: number;
	/** What the shop owes back, when the trade-in was worth more. */
	shop_owes: number;
	direction: "customer_pays" | "shop_pays" | "even";
}

export function settleExchange(
	goodsOut: number,
	tradeIn: number,
	paidNow: number | string | null | undefined,
): { error: string } | { value: ExchangeSettlement } {
	const out = round2(goodsOut);
	const inbound = round2(tradeIn);

	if (!Number.isFinite(out) || out < 0) {
		return { error: "The value of goods sold must be zero or more." };
	}
	if (!Number.isFinite(inbound) || inbound < 0) {
		return { error: "The trade-in valuation must be zero or more." };
	}

	const net = round2(out - inbound);

	// The trade-in covered the whole sale, so nothing is collected and the
	// balance goes back to the customer rather than being kept quietly.
	if (net <= 0) {
		return {
			value: {
				goods_out: out,
				trade_in: inbound,
				net,
				customer_pays: 0,
				customer_due: 0,
				shop_owes: round2(-net),
				direction: net === 0 ? "even" : "shop_pays",
			},
		};
	}

	const paid =
		paidNow === undefined || paidNow === null || paidNow === ""
			? 0
			: round2(Number(paidNow));

	if (!Number.isFinite(paid) || paid < 0) {
		return { error: "Amount paid must be zero or more." };
	}
	if (paid > net + 0.01) {
		return {
			error: `After the trade-in only ৳${net.toLocaleString("en-BD")} is payable — ৳${paid.toLocaleString("en-BD")} was entered.`,
		};
	}

	const collected = round2(Math.min(paid, net));
	return {
		value: {
			goods_out: out,
			trade_in: inbound,
			net,
			customer_pays: collected,
			customer_due: round2(net - collected),
			shop_owes: 0,
			direction: "customer_pays",
		},
	};
}

/**
 * A valuation put on a device taken in. Refuses the two mistakes that matter:
 * a giveaway price entered by accident, and a valuation above what the shop
 * could sell it for.
 */
export function validateTradeInValue(
	value: unknown,
	resalePrice?: number | null,
): { error: string } | { value: number } {
	if (value === undefined || value === null || value === "") {
		return { error: "Put a value on the device being taken in." };
	}

	const amount = Number(value);
	if (!Number.isFinite(amount) || amount < 0) {
		return { error: "A trade-in valuation must be zero or more." };
	}

	if (resalePrice != null && resalePrice > 0 && amount > resalePrice) {
		return {
			error: `Taking this in at ৳${round2(amount).toLocaleString("en-BD")} is more than the ৳${round2(resalePrice).toLocaleString("en-BD")} it would resell for.`,
		};
	}

	return { value: round2(amount) };
}
