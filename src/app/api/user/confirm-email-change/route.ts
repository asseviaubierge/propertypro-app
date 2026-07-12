/**
 * PropertyPro - Confirm Email Change API
 * Public endpoint reached from the verification link sent to the new address.
 * The secure token authorizes the change, so no session is required.
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { User } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
} from "@/lib/api-utils";
import {
  validateInvitationToken,
  markTokenAsUsed,
} from "@/lib/invitation-utils";
import { z } from "zod";

const confirmSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// ============================================================================
// GET /api/user/confirm-email-change - Validate token
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return createErrorResponse("Token is required", 400);
    }

    const result = await validateInvitationToken(token, "email_change");
    if (!result.success || !result.invitation) {
      return createErrorResponse("Invalid or expired token", 400);
    }

    return createSuccessResponse(
      {
        valid: true,
        newEmail: result.invitation.newEmail,
        expiresAt: result.invitation.expiresAt,
      },
      "Token is valid"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// POST /api/user/confirm-email-change - Apply the email change
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    const validation = confirmSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        validation.error.errors.map((e) => e.message).join(", "),
        400
      );
    }

    const { token } = validation.data;

    const result = await validateInvitationToken(token, "email_change");
    if (!result.success || !result.invitation) {
      return createErrorResponse("Invalid or expired token", 400);
    }

    const { userId, newEmail } = result.invitation;

    const user = await User.findById(userId);
    if (!user) {
      return createErrorResponse("User not found", 404);
    }
    if (!user.isActive) {
      return createErrorResponse("Account is deactivated", 403);
    }

    // Re-check uniqueness in case the address was taken after the request.
    const existing = await User.findOne({
      email: newEmail!.toLowerCase(),
      _id: { $ne: user._id },
    }).select("_id");
    if (existing) {
      return createErrorResponse("Email already in use", 409);
    }

    user.email = newEmail!.toLowerCase();
    user.emailVerified = new Date();
    await user.save();

    await markTokenAsUsed(token);

    return createSuccessResponse(
      { message: "Email updated successfully", email: user.email },
      "Your email address has been updated"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
