import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { ThemeProvider } from "@/presentation/contexts/theme-context";
import { MetaPixelProvider } from "@/presentation/components/meta-pixel/MetaPixelProvider";
import { FacebookCookieCapture } from "@/presentation/components/meta-pixel/FacebookCookieCapture";
import { GoogleAnalyticsProvider } from "@/presentation/components/google-analytics/GoogleAnalyticsProvider";
import AppShell from "@/components/AppShell";
import { getStoreName } from "@/lib/get-store-name";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: {
			template: `%s | ${storeName}`,
			default: `${storeName} — Tech, Trust & Service | Electronics Store`,
		},
		description: "Bangladesh's trusted electronics retailer for laptops, smartphones, and tech accessories.",
	};
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning>
			<body className="antialiased">
				{/* Captures fbclid from URL and sets _fbc/_fbp cookies before pixel initialises */}
				<FacebookCookieCapture />
				<MetaPixelProvider>
					<GoogleAnalyticsProvider>
						<ThemeProvider>
							<AppShell>
								{children}
							</AppShell>
						</ThemeProvider>
					</GoogleAnalyticsProvider>
				</MetaPixelProvider>
			</body>
		</html>
	);
}
