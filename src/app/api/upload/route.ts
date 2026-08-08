/**
 * PropertyPro - File Upload API Route
 * Handle file uploads for avatars, logos, and documents
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { deleteFromR2, uploadToR2, validateR2Config } from "@/lib/r2-server";
import { extractObjectKey } from "@/lib/r2";

// File upload configuration
const UPLOAD_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ],
  allowedDocumentTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  uploadDir: process.env.UPLOAD_DIR || /*turbopackIgnore: true*/ "./public/uploads",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

/**
 * Validate file type and size
 */
function validateFile(
  file: File,
  uploadType: string
): { isValid: boolean; error?: string } {
  // Check file size
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return {
      isValid: false,
      error: `File size exceeds ${
        UPLOAD_CONFIG.maxFileSize / 1024 / 1024
      }MB limit`,
    };
  }

  // Check file type based on upload type
  const allowedTypes =
    uploadType === "document"
      ? [
          ...UPLOAD_CONFIG.allowedImageTypes,
          ...UPLOAD_CONFIG.allowedDocumentTypes,
        ]
      : UPLOAD_CONFIG.allowedImageTypes;

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { isValid: true };
}

/**
 * Generate unique filename
 */
function generateFilename(originalName: string, uploadType: string): string {
  const ext = path.extname(originalName);
  const uuid = uuidv4();
  return `${uploadType}_${uuid}${ext}`;
}

/**
 * Save file to disk
 */
async function saveFile(
  buffer: Buffer,
  filename: string,
  uploadType: string
): Promise<string> {
  const typeDir = path.join(UPLOAD_CONFIG.uploadDir, uploadType);

  // Ensure directory exists
  if (!existsSync(typeDir)) {
    await mkdir(typeDir, { recursive: true });
  }

  const filePath = path.join(typeDir, filename);
  await writeFile(filePath, buffer);

  // Return public URL
  return `${UPLOAD_CONFIG.baseUrl}/uploads/${uploadType}/${filename}`;
}

/**
 * Delete old file if exists
 */
async function deleteOldFile(oldUrl: string): Promise<void> {
  try {
    if (oldUrl && oldUrl.includes("/uploads/")) {
      const relativePath = oldUrl.split("/uploads/")[1];
      const fullPath = path.join(UPLOAD_CONFIG.uploadDir, relativePath);

      if (existsSync(fullPath)) {
        const fs = await import("fs/promises");
        await fs.unlink(fullPath);
      }
    }
  } catch (error) {
    console.error("Error deleting old file:", error);
    // Don't throw error, just log it
  }
}

function extractR2ObjectKey(url: string): string | null {
  const extracted = extractObjectKey(url);
  if (extracted) return extracted;

  try {
    const publicUrl = process.env.R2_PUBLIC_URL || "";
    if (!publicUrl || !url.includes(publicUrl)) return null;
    const urlObj = new URL(url);
    const key = urlObj.pathname.startsWith("/")
      ? urlObj.pathname.slice(1)
      : urlObj.pathname;
    return key || null;
  } catch {
    return null;
  }
}

function isR2FileUrl(url: string): boolean {
  const publicUrl =
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  return (
    (publicUrl.length > 0 && url.includes(publicUrl)) ||
    url.includes("r2.cloudflarestorage.com")
  );
}

// ============================================================================
// POST /api/upload - Upload files
// ============================================================================
export const POST = withPermissionAndDB([
  "profile_management",
  "document_management",
])(async (user: any, request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const uploadType = formData.get("type") as string;
    const oldFileUrl = formData.get("oldFileUrl") as string;
    const folder = (formData.get("folder") as string) || "";

    if (!file) {
      return createErrorResponse("No file provided", 400);
    }

    if (!uploadType) {
      return createErrorResponse("Upload type is required", 400);
    }

    // Validate upload type
    const validTypes = ["avatar", "logo", "favicon", "document"];
    if (!validTypes.includes(uploadType)) {
      return createErrorResponse("Invalid upload type", 400);
    }

    // Validate file
    const validation = validateFile(file, uploadType);
    if (!validation.isValid) {
      return createErrorResponse(validation.error!, 400);
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const r2Validation = validateR2Config();
    const shouldUseR2 = uploadType === "document";

    if (shouldUseR2 && !r2Validation.isValid) {
      return createErrorResponse(
        `R2 storage is not configured. ${r2Validation.errors.join(", ")}`,
        500
      );
    }

    if (shouldUseR2) {
      const uploadResult = await uploadToR2(file, {
        folder: folder.trim() || `PropertyPro/uploads/documents/${user.id}`,
        quality: 85,
      });

      if (!uploadResult.success || !uploadResult.url) {
        return createErrorResponse(uploadResult.error || "R2 upload failed", 500);
      }

      if (oldFileUrl && isR2FileUrl(oldFileUrl)) {
        const objectKey = extractR2ObjectKey(oldFileUrl);
        if (objectKey) {
          await deleteFromR2(objectKey);
        }
      } else if (oldFileUrl) {
        await deleteOldFile(oldFileUrl);
      }

      return createSuccessResponse({
        url: uploadResult.url,
        filename: uploadResult.objectKey?.split("/").pop() || "",
        objectKey: uploadResult.objectKey,
        originalName: file.name,
        size: uploadResult.bytes ?? buffer.length,
        type: file.type,
        uploadType,
        storage: "r2",
        message: "File uploaded successfully",
      });
    }

    // Generate filename
    const filename = generateFilename(file.name, uploadType);

    // Save file (no image processing)
    const fileUrl = await saveFile(buffer, filename, uploadType);

    // Delete old file if provided
    if (oldFileUrl) {
      await deleteOldFile(oldFileUrl);
    }

    return createSuccessResponse({
      url: fileUrl,
      filename,
      originalName: file.name,
      size: buffer.length,
      type: file.type,
      uploadType,
      storage: "local",
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/upload - Delete files
// ============================================================================
export const DELETE = withPermissionAndDB([
  "profile_management",
  "document_management",
])(async (user: any, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return createErrorResponse("File URL is required", 400);
    }

    if (isR2FileUrl(fileUrl)) {
      const objectKey = extractR2ObjectKey(fileUrl);
      if (objectKey) {
        await deleteFromR2(objectKey);
      }
    } else {
      await deleteOldFile(fileUrl);
    }

    return createSuccessResponse({
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// GET /api/upload - Get upload configuration
// ============================================================================
export const GET = withPermissionAndDB([
  "file_management",
  "document_management",
])(async () => {
  try {
    return createSuccessResponse({
      maxFileSize: UPLOAD_CONFIG.maxFileSize,
      allowedImageTypes: UPLOAD_CONFIG.allowedImageTypes,
      allowedDocumentTypes: UPLOAD_CONFIG.allowedDocumentTypes,
    });
  } catch (error) {
    console.error("Get upload config error:", error);
    return handleApiError(error);
  }
});