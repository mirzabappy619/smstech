/**
 * Re-export of the real API helpers.
 *
 * This module used to be a second, hand-maintained copy of `@/lib/api-utils`.
 * The copies drifted — most importantly this one's `requireAdmin()` was missing
 * the cashier, inventory_manager, accountant and delivery_agent roles — and the
 * unit tests imported the copy, so they were validating code no route ran.
 *
 * Keep it as a pure re-export: `@/lib/api-utils` is the single source of truth.
 */
export * from "@/lib/api-utils";
