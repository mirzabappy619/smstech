/**
 * Meta Pixel Provider
 * Loads Meta Pixel settings, initializes the pixel, and tracks SPA route changes
 */

"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MetaPixel, generateMetaEventId } from "./MetaPixel";

interface MetaPixelSettings {
	pixelId: string;
	enabled: boolean;
	enabledEvents: string[];
	testMode: boolean;
}

function MetaPixelNavigationTracker({
	enabled,
	enabledEvents,
}: {
	enabled: boolean;
	enabledEvents: string[];
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const isFirstMount = useRef(true);

	useEffect(() => {
		// First mount PageView is handled by Script onLoad in MetaPixel component
		if (isFirstMount.current) {
			isFirstMount.current = false;
			return;
		}

		if (!enabled || !enabledEvents.includes("PageView")) return;

		if (typeof window !== "undefined" && window.fbq) {
			const pageViewEventId = generateMetaEventId("pv");
			window.fbq("track", "PageView", {}, { eventID: pageViewEventId });
		}
	}, [pathname, searchParams, enabled, enabledEvents]);

	return null;
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
				<>
					<MetaPixel
						pixelId={settings.pixelId}
						enabled={settings.enabled}
						enabledEvents={settings.enabledEvents}
						externalId={externalId}
					/>
					<Suspense fallback={null}>
						<MetaPixelNavigationTracker
							enabled={settings.enabled}
							enabledEvents={settings.enabledEvents}
						/>
					</Suspense>
				</>
			)}
			{children}
		</>
	);
}
