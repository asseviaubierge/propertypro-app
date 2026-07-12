/**
 * PropertyPro - User Profile API Routes
 * CRUD operations for user profile management
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
import { userSchema } from "@/lib/validations";

const profileUpdateSchema = userSchema.omit({ password: true }).partial();

// ============================================================================
// GET /api/user/profile - Get current user profile
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (user: any) => {
  try {
    const userId = String(user?.id || "");
    const userEmail = String(user?.email || "").trim().toLowerCase();

    let currentUser = null;

    if (userId && isValidObjectId(userId)) {
      currentUser = await User.findById(userId).select("-password");
    }

    if (!currentUser && userEmail) {
      currentUser = await User.findOne({ email: userEmail }).select(
        "-password"
      );
    }

    if (!currentUser) {
      return createErrorResponse("User not found", 404);
    }

    return createSuccessResponse({
      user: currentUser,
      message: "Profile retrieved successfully",
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/user/profile - Update user profile
// ============================================================================
export const PUT = withPermissionAndDB("profile_management")(
  async (user: any, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Validate the request body
      const validation = profileUpdateSchema.safeParse(body);
      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(", ");
        return createErrorResponse(`Validation failed: ${errors}`, 400);
      }

      const updateData = { ...validation.data };
      const userId = String(user?.id || "");
      const userEmail = String(user?.email || "").trim().toLowerCase();

      let currentUser = null;

      if (userId && isValidObjectId(userId)) {
        currentUser = await User.findById(userId).select("email");
      }

      if (!currentUser && userEmail) {
        currentUser = await User.findOne({ email: userEmail }).select("email");
      }

      if (!currentUser) {
        return createErrorResponse("User not found", 404);
      }

      // Only check for conflicts when the email actually changes.
      if (typeof updateData.email === "string") {
        const nextEmail = updateData.email.trim().toLowerCase();
        const currentEmail = String(currentUser.email || "")
          .trim()
          .toLowerCase();

        updateData.email = nextEmail;

        if (nextEmail !== currentEmail) {
          const existingUser = await User.findOne({
            email: nextEmail,
            _id: { $ne: currentUser._id },
          }).select("_id");

          if (existingUser) {
            return createErrorResponse("Email already in use", 409);
          }

          // The new address hasn't been confirmed yet — require re-verification.
          (updateData as Record<string, unknown>).emailVerified = null;
        }
      }

      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(currentUser._id, updateData, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!updatedUser) {
        return createErrorResponse("User not found", 404);
      }

      return createSuccessResponse({
        user: updatedUser,
        message: "Profile updated successfully",
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);
