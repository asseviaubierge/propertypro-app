/**
 * PropertyPro - Branding Upload API
 * Handle file uploads for branding assets (logos, favicons, etc.) to R2
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withRoleAndDB,
} from "@/lib/api-utils";
import {
  uploadBrandingAsset,
  validateR2Config,
  deleteFromR2,
} from "@/lib/r2-server";
import { isR2Url, extractObjectKey } from "@/lib/r2";

// ============================================================================
// POST /api/upload/branding - Upload branding assets to R2
// ============================================================================
export const POST = withRoleAndDB(UserRole.ADMIN)(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {

      // Validate R2 configuration
      const configValidation = validateR2Config();
      if (!configValidation.isValid) {
        return createErrorResponse(
          `R2 configuration error: ${configValidation.errors.join(", ")}`,
          500
        );
      }

      const formData = await request.formData();
      const file = formData.get("file") as File;
      const type = formData.get("type") as string; // 'logo' or 'favicon'
      const variant = formData.get("variant") as string; // 'light' or 'dark' for logos

      if (!file) {
        return createErrorResponse("No file provided", 400);
      }

      if (!type) {
        return createErrorResponse("Type is required", 400);
      }

      // Validate file type
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/svg+xml",
        "image/x-icon",
        "image/vnd.microsoft.icon",
      ];

      if (!allowedTypes.includes(file.type)) {
        return createErrorResponse(
          "Invalid file type. Only PNG, JPEG, JPG, WebP, SVG, and ICO files are allowed.",
          400
        );
      }

      // Validate file size (2MB max)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        return createErrorResponse("File size must be less than 2MB", 400);
      }

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload to R2
      const uploadResult = await uploadBrandingAsset(
        buffer,
        file.name,
        type as "logo" | "favicon",
        variant as "light" | "dark" | undefined
      );

      return createSuccessResponse({
        url: uploadResult.url,
        objectKey: uploadResult.objectKey,
        metadata: uploadResult.metadata,
        optimizedUrls: uploadResult.optimizedUrls,
        validation: uploadResult.validation,
        message: "File uploaded successfully to R2",
      });
    } catch (error) {
      console.error("Branding upload error:", error);
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/upload/branding - Delete branding asset from R2
// ============================================================================
export const DELETE = withRoleAndDB(UserRole.ADMIN)(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {

      // Validate R2 configuration
      const configValidation = validateR2Config();
      if (!configValidation.isValid) {
        return createErrorResponse(
          `R2 configuration error: ${configValidation.errors.join(", ")}`,
          500
        );
      }

      const { searchParams } = new URL(request.url);
      const url = searchParams.get("url");
      const objectKey = searchParams.get("objectKey");

      // Accept either URL or objectKey
      let keyToDelete = objectKey;

      if (!keyToDelete && url) {
        // Extract objectKey from URL if provided
        if (isR2Url(url)) {
          keyToDelete = extractObjectKey(url);
        }
      }

      if (!keyToDelete) {
        return createErrorResponse(
          "Either objectKey or url parameter is required",
          400
        );
      }

      // Delete from R2
      await deleteFromR2(keyToDelete);

      return createSuccessResponse({
        message: "File deleted successfully from R2",
        objectKey: keyToDelete,
      });
    } catch (error) {
      console.error("Branding delete error:", error);
      return handleApiError(error);
    }
  }
);
