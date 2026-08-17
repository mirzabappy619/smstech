"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, AlertCircle, ExternalLink } from "lucide-react";

interface GASettings {
  id?: string;
  measurement_id: string;
  enabled: boolean;
  enabled_events: string[];
}

const ALL_EVENTS = [
  { id: "page_view", label: "Page View", description: "Automatic tracking of all page loads" },
  { id: "view_item", label: "View Item", description: "When user views a product detail page" },
  { id: "add_to_cart", label: "Add to Cart", description: "When user adds item to shopping cart" },
  { id: "begin_checkout", label: "Begin Checkout", description: "When user proceeds to checkout" },
  { id: "purchase", label: "Purchase", description: "When order is successfully completed" },
];

export default function GoogleAnalyticsPage() {
  const [settings, setSettings] = useState<GASettings>({
    measurement_id: "",
    enabled: false,
    enabled_events: ["page_view"],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"configuration" | "debug">("configuration");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/v1/admin/google-analytics");
      if (response.ok) {
        const data = await response.json();
        setSettings(
          data.data || {
            measurement_id: "",
            enabled: false,
            enabled_events: ["page_view"],
          }
        );
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (settings.enabled && !settings.measurement_id.trim()) {
      setMessage({ type: "error", text: "Measurement ID is required when tracking is enabled" });
      return;
    }

    if (settings.measurement_id && !/^G-[A-Z0-9]+$/.test(settings.measurement_id)) {
      setMessage({
        type: "error",
        text: "Invalid Measurement ID format. Must start with 'G-' followed by alphanumeric characters",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/google-analytics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurement_id: settings.measurement_id.trim(),
          enabled: settings.enabled,
          enabled_events: settings.enabled_events,
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Settings saved successfully" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error?.message || "Failed to save settings" });
      }
    } catch (error) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: "An error occurred while saving" });
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSettings((prev) => ({
      ...prev,
      enabled_events: prev.enabled_events.includes(eventId)
        ? prev.enabled_events.filter((e) => e !== eventId)
        : [...prev.enabled_events, eventId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex items-center justify-center">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Google Analytics</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Configure Google Analytics 4 (GA4) tracking for your storefront
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            }`}>
            {message.type === "success" ? (
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-zinc-800 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("configuration")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "configuration"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}>
              Configuration
            </button>
            <button
              onClick={() => setActiveTab("debug")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "debug"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}>
              Debug
            </button>
          </div>
        </div>

        {/* Configuration Tab */}
        {activeTab === "configuration" && (
          <div className="space-y-6">
            {/* Enable Toggle */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Enable Tracking</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Turn on Google Analytics tracking on your storefront
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-zinc-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-zinc-900 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Measurement ID */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-gray-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                GA4 Measurement ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="G-XXXXXXXXXX"
                value={settings.measurement_id}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    measurement_id: e.target.value.toUpperCase(),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Find this in GA4 admin → Data Streams → Select your web stream → Measurement ID
              </p>
            </div>

            {/* Enabled Events */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-gray-200 dark:border-zinc-700">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Tracked Events</h3>
              <div className="space-y-3">
                {ALL_EVENTS.map((event) => (
                  <label key={event.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition">
                    <input
                      type="checkbox"
                      checked={settings.enabled_events.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white">{event.label}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{event.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}

        {/* Debug Tab */}
        {activeTab === "debug" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-gray-200 dark:border-zinc-700">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Debug Mode</h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-zinc-900 dark:text-white mb-2">View Real-time Data</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Monitor events being collected in real-time:
                  </p>
                  <Link
                    href={`https://analytics.google.com/analytics/web/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition">
                    Open GA4 Dashboard
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                <div>
                  <h4 className="font-medium text-zinc-900 dark:text-white mb-2">Debug View</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    To see debug events, add this parameter to your storefront URL:
                  </p>
                  <code className="block bg-gray-100 dark:bg-zinc-900 p-3 rounded-lg text-sm font-mono text-zinc-900 dark:text-zinc-100 break-all">
                    ?gtag_debug=1
                  </code>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                    Example: https://yourstore.com/products/example?gtag_debug=1
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-zinc-900 dark:text-white mb-2">Current Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">Tracking Enabled:</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {settings.enabled ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400">No</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">Measurement ID:</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {settings.measurement_id || <span className="text-zinc-400">Not set</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">Events Tracked:</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {settings.enabled_events.length} / {ALL_EVENTS.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
