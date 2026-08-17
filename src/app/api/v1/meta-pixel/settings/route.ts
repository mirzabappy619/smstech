/**
 * Meta Pixel Public Settings API
 * Returns public pixel configuration for client-side initialization
 */

import { MetaPixelService } from "@/infrastructure/meta-pixel/meta-pixel-service";
import { successResponse, errorResponse } from "@/app/api-utils";

export async function GET() {
	try {
		const settings = await MetaPixelService.getClientSettings();

		if (!settings) {
			return successResponse({
				enabled: false,
				pixelId: "",
				enabledEvents: [],
				testMode: false,
			});
		}

		return successResponse(settings);
	} catch (error) {
		console.error("Error fetching Meta Pixel public settings:", error);
		return errorResponse("FETCH_ERROR", "Failed to fetch settings", 500);
	}
}
