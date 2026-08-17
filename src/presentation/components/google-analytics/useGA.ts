import { useGoogleAnalytics } from "./GoogleAnalyticsProvider";

export function useGA() {
  const { enabled, enabledEvents } = useGoogleAnalytics();

  const trackEvent = (eventName: string, parameters?: Record<string, unknown>) => {
    if (!enabled || !enabledEvents.includes(eventName)) return;

    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", eventName, parameters);
    }
  };

  return { trackEvent, enabled, enabledEvents };
}
