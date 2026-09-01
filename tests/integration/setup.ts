/**
 * Integration tests drive a running app over HTTP.
 *
 * They are opt-in (`npm run test:integration`) because without a server every
 * case fails with ECONNREFUSED, which buried real failures in noise and made
 * the default test run red. Point them elsewhere with TEST_BASE_URL.
 */
import { beforeAll } from "vitest";

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

beforeAll(async () => {
	try {
		await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
	} catch {
		throw new Error(
			`No server reachable at ${BASE_URL}. Start one with \`npm run dev\` ` +
				`(or set TEST_BASE_URL) before running the integration suite.`,
		);
	}
});
