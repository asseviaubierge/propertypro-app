/**
 * PropertyPro - Change Password API
 * Allows an authenticated user to change their own password.
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { User } from "@/models";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { z } from "zod";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters long")
      .max(128, "Password cannot exceed 128 characters"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

// ============================================================================
// POST /api/user/change-password - Change own password
// ============================================================================
export const POST = withPermissionAndDB("profile_management")(
  async (sessionUser: any, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const validation = changePasswordSchema.safeParse(body);
      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message);
        return createErrorResponse(errors.join(", "), 400);
      }

      const { currentPassword, newPassword } = validation.data;

      // Load the user with the password field (select: false by default)
      const userId = String(sessionUser?.id || "");
      const userEmail = String(sessionUser?.email || "").trim().toLowerCase();

      let user = null;
      if (userId && isValidObjectId(userId)) {
        user = await User.findById(userId).select("+password");
      }
      if (!user && userEmail) {
        user = await User.findOne({ email: userEmail }).select("+password");
      }

      if (!user) {
        return createErrorResponse("User not found", 404);
      }

      // OAuth-only accounts have no password set yet.
      if (!user.password) {
        return createErrorResponse(
          "Your account has no password set. Use the password reset flow to create one.",
          400
        );
      }

      const isvalid = await user.comparePassword(currentPassword);
      if (!isvalid) {
        return createErrorResponse("Current password is incorrect", 400);
      }

      // Assigning triggers the model's pre-save hashing middleware.
      user.password = newPassword;
      await user.save();

      return createSuccessResponse(
        { message: "Password changed successfully" },
        "Password changed successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);
