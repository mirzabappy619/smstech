"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { GoogleAnalytics } from "./GoogleAnalytics";

interface GoogleAnalyticsSettings {
  enabled: boolean;
  measurementId: string;
  enabledEvents: string[];
}

const GoogleAnalyticsContext = createContext<GoogleAnalyticsSettings | null>(null);

export function GoogleAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<GoogleAnalyticsSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/v1/google-analytics/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data.data || { enabled: false, measurementId: "", enabledEvents: [] });
        }
      } catch (error) {
        console.error("Failed to fetch GA settings:", error);
        setSettings({ enabled: false, measurementId: "", enabledEvents: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return (
    <>
      {!loading && settings && settings.enabled && settings.measurementId && (
        <GoogleAnalytics
          measurementId={settings.measurementId}
          enabledEvents={settings.enabledEvents}
        />
      )}
      <GoogleAnalyticsContext.Provider value={settings}>
        {children}
      </GoogleAnalyticsContext.Provider>
    </>
  );
}

export function useGoogleAnalytics() {
  const context = useContext(GoogleAnalyticsContext);
  if (!context) {
    return {
      enabled: false,
      measurementId: "",
      enabledEvents: [],
    };
  }
  return context;
}
