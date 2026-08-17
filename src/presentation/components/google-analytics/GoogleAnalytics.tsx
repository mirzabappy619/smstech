"use client";

import Script from "next/script";
import { useRef } from "react";

interface GoogleAnalyticsProps {
  measurementId: string;
  enabledEvents: string[];
}

export function GoogleAnalytics({ measurementId, enabledEvents }: GoogleAnalyticsProps) {
  const initializedRef = useRef(false);

  const handleScriptLoad = () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (window.gtag) {
      window.gtag("config", measurementId, {
        send_page_view: enabledEvents.includes("page_view"),
      });
    }
  };

  return (
    <Script
      id="ga4"
      strategy="afterInteractive"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      onLoad={handleScriptLoad}
    />
  );
}

export function trackGAEvent(eventName: string, parameters?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, parameters);
  }
}

export function trackGAPurchase(data: {
  eventId: string;
  transactionId: string;
  value: number;
  currency: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: data.transactionId,
      value: data.value,
      currency: data.currency,
      items: data.items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }
}

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}
