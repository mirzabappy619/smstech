import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	jsonResponse,
	errorResponse,
	validationErrorResponse,
} from "@/lib/api-utils";
import { storageService, BUCKETS, BucketName } from "@/infrastructure/storage";
import { z } from "zod";

const signedUrlSchema = z.object({
	bucket: z.string(),
	path: z.string(),
	type: z.enum(["download", "upload"]).default("download"),
	expiresIn: z.number().min(60).max(604800).default(3600), // 1 minute to 7 days
});

export async function POST(request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
		}

		const body = await request.json();
		const validation = signedUrlSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { bucket, path, type, expiresIn } = validation.data;

		// Validate bucket
		if (!Object.values(BUCKETS).includes(bucket as BucketName)) {
			return errorResponse("INVALID_BUCKET", "Invalid bucket", 400);
		}

		if (type === "upload") {
			// Generate signed upload URL
			const result = await storageService.getSignedUploadUrl({ bucket, path });

			if (!result.success) {
				return errorResponse(
					"UPLOAD_URL_FAILED",
					result.error || "Failed to generate upload URL",
					500,
				);
			}

			return jsonResponse({
				signedUrl: result.signedUrl,
				token: result.token,
				expiresIn,
			});
		} else {
			// Generate signed download URL
			const result = await storageService.getSignedUrl({
				bucket,
				path,
				expiresIn,
				download: true,
			});

			if (!result.success) {
				return errorResponse(
					"DOWNLOAD_URL_FAILED",
					result.error || "Failed to generate download URL",
					500,
				);
			}

			return jsonResponse({
				signedUrl: result.signedUrl,
				expiresIn,
			});
		}
	} catch (error) {
		console.error("Signed URL error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
