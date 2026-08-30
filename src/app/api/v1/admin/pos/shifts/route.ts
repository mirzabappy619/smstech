import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Expected drawer cash for a shift.
 *
 * opening float + cash sales + dues collected in cash
 *   + cash in - cash out - safe drops
 *
 * Both the close-shift handler and the terminal read this, so the cashier is
 * always reconciled against the same number they were shown.
 */
async function expectedCash(supabase: SupabaseClient, shiftId: string) {
	const { data, error } = await supabase.rpc("shift_expected_cash", {
		p_shift_id: shiftId,
	});
	if (error) throw error;
	return round2(Number(data) || 0);
}

async function withDrawerFigures(
	supabase: SupabaseClient,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	shift: any,
) {
	if (!shift) return shift;

	const { data: movements } = await supabase
		.from("pos_cash_movements")
		.select("id, type, amount, reason, created_at")
		.eq("shift_id", shift.id)
		.order("created_at", { ascending: false });

	return {
		...shift,
		cash_movements: movements || [],
		closing_cash_expected: await expectedCash(supabase, shift.id),
	};
}

// GET current active shift for warehouse/cashier or shift history
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const warehouseId = searchParams.get("warehouse_id");
		const status = searchParams.get("status") || "open";

		const supabase = await getSupabaseServerClient();

		if (status === "open" && warehouseId) {
			const { data: openShift } = await supabase
				.from("pos_shifts")
				.select(
					`
          *,
          warehouses (id, name, code)
        `,
				)
				.eq("warehouse_id", warehouseId)
				.eq("status", "open")
				.maybeSingle();

			return NextResponse.json({
				success: true,
				data: openShift ? await withDrawerFigures(supabase, openShift) : null,
			});
		}

		// Otherwise list shifts
		let query = supabase
			.from("pos_shifts")
			.select(
				`
        *,
        warehouses (id, name, code)
      `,
			)
			.order("created_at", { ascending: false })
			.limit(30);

		if (warehouseId) query = query.eq("warehouse_id", warehouseId);

		const { data: shifts, error } = await query;
		if (error) throw error;

		return NextResponse.json({ success: true, data: shifts || [] });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

// POST: Open Shift, Close Shift, or Add Cash Movement
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const {
			action,
			warehouse_id,
			opening_float,
			closing_cash_actual,
			shift_id,
			movement_type,
			movement_amount,
			reason,
			notes,
		} = body;
		const supabase = await getSupabaseServerClient();

		if (action === "open_shift") {
			if (!warehouse_id) {
				return NextResponse.json(
					{ success: false, error: "Select a branch before opening a shift." },
					{ status: 400 },
				);
			}

			const float = Number(opening_float);
			if (!Number.isFinite(float) || float < 0) {
				return NextResponse.json(
					{ success: false, error: "Opening float must be zero or more." },
					{ status: 400 },
				);
			}

			const shiftNumber = `SHIFT-${Date.now().toString().slice(-6)}`;
			const { data: newShift, error } = await supabase
				.from("pos_shifts")
				.insert({
					shift_number: shiftNumber,
					warehouse_id,
					opening_float: float,
					closing_cash_expected: float,
					status: "open",
					notes: notes || null,
				})
				.select()
				.single();

			if (error) {
				// A partial unique index on (warehouse_id) WHERE status='open'
				// makes this the single source of truth, rather than a
				// check-then-insert that two cashiers can both pass.
				if (error.code === "23505") {
					return NextResponse.json(
						{
							success: false,
							error: "A register shift is already open for this branch.",
						},
						{ status: 409 },
					);
				}
				throw error;
			}

			return NextResponse.json({
				success: true,
				data: await withDrawerFigures(supabase, newShift),
			});
		}

		if (action === "cash_movement") {
			const amount = Number(movement_amount);

			if (!shift_id) {
				return NextResponse.json(
					{ success: false, error: "shift_id is required" },
					{ status: 400 },
				);
			}

			if (!Number.isFinite(amount) || amount <= 0) {
				return NextResponse.json(
					{ success: false, error: "Enter an amount greater than zero." },
					{ status: 400 },
				);
			}

			const allowedTypes = ["cash_in", "cash_out", "drop", "float_adjustment"];
			const type = movement_type || "drop";
			if (!allowedTypes.includes(type)) {
				return NextResponse.json(
					{ success: false, error: `"${type}" is not a drawer movement type.` },
					{ status: 400 },
				);
			}

			const { data: shift } = await supabase
				.from("pos_shifts")
				.select("id, status")
				.eq("id", shift_id)
				.maybeSingle();

			if (!shift) {
				return NextResponse.json(
					{ success: false, error: "Shift not found" },
					{ status: 404 },
				);
			}
			if (shift.status !== "open") {
				return NextResponse.json(
					{ success: false, error: "That shift is already closed." },
					{ status: 409 },
				);
			}

			// Taking money out of the drawer cannot leave it negative.
			if (type === "cash_out" || type === "drop") {
				const available = await expectedCash(supabase, shift_id);
				if (amount > available) {
					return NextResponse.json(
						{
							success: false,
							error: `Only ৳${available.toLocaleString("en-BD")} is in the drawer.`,
						},
						{ status: 400 },
					);
				}
			}

			const { data: movement, error } = await supabase
				.from("pos_cash_movements")
				.insert({
					shift_id,
					type,
					amount,
					reason: reason || "Mid-day drawer adjustment",
				})
				.select()
				.single();

			if (error) throw error;

			return NextResponse.json({
				success: true,
				data: movement,
				expected_cash: await expectedCash(supabase, shift_id),
			});
		}

		if (action === "close_shift") {
			if (!shift_id) {
				return NextResponse.json(
					{ success: false, error: "shift_id is required" },
					{ status: 400 },
				);
			}

			const { data: currentShift, error: fetchErr } = await supabase
				.from("pos_shifts")
				.select("*")
				.eq("id", shift_id)
				.single();

			if (fetchErr || !currentShift) {
				return NextResponse.json(
					{ success: false, error: "Shift not found" },
					{ status: 404 },
				);
			}

			if (currentShift.status === "closed") {
				return NextResponse.json(
					{ success: false, error: "That shift is already closed." },
					{ status: 409 },
				);
			}

			const actual = Number(closing_cash_actual);
			if (!Number.isFinite(actual) || actual < 0) {
				return NextResponse.json(
					{ success: false, error: "Enter the cash counted in the drawer." },
					{ status: 400 },
				);
			}

			const expected = await expectedCash(supabase, shift_id);
			const difference = round2(actual - expected);

			const { data: closedShift, error: closeErr } = await supabase
				.from("pos_shifts")
				.update({
					closing_cash_actual: actual,
					closing_cash_expected: expected,
					difference,
					status: "closed",
					closed_at: new Date().toISOString(),
					notes: notes || currentShift.notes,
				})
				.eq("id", shift_id)
				.eq("status", "open")
				.select()
				.single();

			if (closeErr) throw closeErr;

			return NextResponse.json({ success: true, data: closedShift });
		}

		return NextResponse.json(
			{ success: false, error: "Invalid action" },
			{ status: 400 },
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("POS shift action failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}
