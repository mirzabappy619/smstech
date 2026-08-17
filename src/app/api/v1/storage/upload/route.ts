import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";
import {
	storageService,
	BUCKETS,
	ALLOWED_TYPES,
	MAX_SIZES,
	BucketName,
} from "@/infrastructure/storage";

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

		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const bucket = formData.get("bucket") as string | null;
		const folder = formData.get("folder") as string | null;

		if (!file) {
			return errorResponse("NO_FILE", "No file provided", 400);
		}

		if (!bucket) {
			return errorResponse("BUCKET_REQUIRED", "Bucket is required", 400);
		}

		// Validate bucket
		if (!Object.values(BUCKETS).includes(bucket as BucketName)) {
			return errorResponse("INVALID_BUCKET", "Invalid bucket", 400);
		}

		// Validate file type
		const allowedTypes = ALLOWED_TYPES[bucket as BucketName];
		if (!allowedTypes.includes(file.type)) {
			return errorResponse(
				"INVALID_FILE_TYPE",
				`Invalid file type. Allowed: ${allowedTypes.join(", ")}`,
				400,
			);
		}

		// Validate file size
		const maxSize = MAX_SIZES[bucket as BucketName];
		if (file.size > maxSize) {
			return errorResponse(
				"FILE_TOO_LARGE",
				`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
				400,
			);
		}

		// Generate path
		const prefix = folder || user.id;
		const path = storageService.generatePath(prefix, file.name);

		// Upload file
		const result = await storageService.upload({
			bucket,
			path,
			file,
			contentType: file.type,
		});

		if (!result.success) {
			return errorResponse(
				"UPLOAD_FAILED",
				result.error || "Upload failed",
				500,
			);
		}

		return jsonResponse({
			path: result.path,
			publicUrl: result.publicUrl,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
