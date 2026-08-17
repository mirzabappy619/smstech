/**
 * Meta Pixel Provider
 * Loads Meta Pixel settings and initializes the pixel
 */

"use client";

import { useEffect, useState } from "react";
import { MetaPixel } from "./MetaPixel";

interface MetaPixelSettings {
	pixelId: string;
	enabled: boolean;
	enabledEvents: string[];
	testMode: boolean;
}

export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
	const [settings, setSettings] = useState<MetaPixelSettings | null>(null);
	const [externalId, setExternalId] = useState<string | undefined>(undefined);

	useEffect(() => {
		fetch("/api/v1/meta-pixel/settings")
			.then((res) => res.json())
			.then((data) => {
				if (data.success && data.data) {
					setSettings(data.data);
				}
			})
			.catch((error) => {
				console.error("Failed to load Meta Pixel settings:", error);
			});

		// Fetch current user ID to pass as external_id in fbq('init')
		// This improves match quality for all browser pixel events.
		fetch("/api/v1/auth/me", { credentials: "include" })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.id) {
					setExternalId(data.id);
				}
			})
			.catch(() => {});
	}, []);

	return (
		<>
			{settings && settings.enabled && (
				<MetaPixel
					pixelId={settings.pixelId}
					enabled={settings.enabled}
					enabledEvents={settings.enabledEvents}
					externalId={externalId}
				/>
			)}
			{children}
		</>
	);
}
