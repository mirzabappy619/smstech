"use client";

/**
 * FacebookCookieCapture
 *
 * Runs on every page load. When a user arrives from a Facebook ad the URL
 * contains ?fbclid=<value>. This component:
 *   1. Reads fbclid from the URL search params
 *   2. Writes the _fbc cookie in Meta's required format:
 *        fb.1.<timestamp_ms>.<fbclid>
 *   3. Creates the _fbp browser identifier cookie if it does not exist:
 *        fb.1.<timestamp_ms>.<random_number>
 *
 * Both cookies are set for 90 days at path=/ so they persist across the
 * entire site and are available to every Meta Pixel and CAPI call.
 *
 * Must be rendered early in the layout (before MetaPixel initialises) so
 * that fbq("init") can pick up the already-set cookies.
 */

import { useEffect } from "react";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function setCookie(name: string, value: string, maxAgeMs: number) {
  const expires = new Date(Date.now() + maxAgeMs).toUTCString();
  // SameSite=Lax is fine — cookies are first-party from this domain
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | undefined {
  return document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(name + "="))
    ?.split("=")
    .slice(1)
    .join("=");
}

export function FacebookCookieCapture() {
  useEffect(() => {
    const ts = Date.now();

    // ── _fbc  (Facebook Click ID) ───────────────────────────────────────────
    // Only update _fbc when the user arrives via a Facebook ad (fbclid present).
    // Preserve any existing _fbc for return visitors browsing without a new click.
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid) {
      const fbc = `fb.1.${ts}.${fbclid}`;
      setCookie("_fbc", fbc, NINETY_DAYS_MS);
      // Mirror in sessionStorage so it survives in-page SPA navigations
      // where the fbclid query string is stripped.
      try {
        sessionStorage.setItem("_fbc", fbc);
      } catch {}
    } else {
      // Restore from sessionStorage if the cookie was cleared mid-session
      const stored = (() => {
        try { return sessionStorage.getItem("_fbc"); } catch { return null; }
      })();
      if (stored && !getCookie("_fbc")) {
        setCookie("_fbc", stored, NINETY_DAYS_MS);
      }
    }

    // ── _fbp  (Facebook Browser Pixel ID) ──────────────────────────────────
    // Generated once per browser, refreshed on expiry.
    if (!getCookie("_fbp")) {
      const random = Math.floor(Math.random() * 2147483647);
      setCookie("_fbp", `fb.1.${ts}.${random}`, NINETY_DAYS_MS);
    }
  }, []);

  return null;
}
