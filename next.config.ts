import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ['pdfkit', 'fontkit', 'restructure', 'deep-equal'],
	images: {
		formats: ['image/avif', 'image/webp'],
		minimumCacheTTL: 31536000, // 1 year Edge CDN cache TTL
		dangerouslyAllowSVG: true,
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
		remotePatterns: [
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "**.supabase.co",
			},
			{
				protocol: "https",
				hostname: "picsum.photos",
			},
		],
	},
	async headers() {
		return [
			{
				// Custom CDN image proxy cache headers for Cloudflare Edge
				source: "/api/v1/cdn/(.*)",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable",
					},
					{
						key: "CDN-Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
					{
						key: "Cloudflare-CDN-Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
		];
	},
};

export default nextConfig;
