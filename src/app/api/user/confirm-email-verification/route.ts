/**
 * PropertyPro - Confirm Email Verification API
 * Public endpoint reached from the verification link.
 * The secure token authorizes the verification, so no session is required.
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
// GET /api/user/confirm-email-verification - Validate token
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return createErrorResponse("Token is required", 400);
    }

    const result = await validateInvitationToken(token, "email_verification");
    if (!result.success || !result.invitation) {
      return createErrorResponse("Invalid or expired token", 400);
    }

    return createSuccessResponse(
      {
        valid: true,
        email: result.invitation.email,
        expiresAt: result.invitation.expiresAt,
      },
      "Token is valid"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// POST /api/user/confirm-email-verification - Mark the email as verified
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

    const result = await validateInvitationToken(token, "email_verification");
    if (!result.success || !result.invitation) {
      return createErrorResponse("Invalid or expired token", 400);
    }

    const { userId, email } = result.invitation;

    const user = await User.findById(userId);
    if (!user) {
      return createErrorResponse("User not found", 404);
    }
    if (!user.isActive) {
      return createErrorResponse("Account is deactivated", 403);
    }

    // Only verify if the email still matches the one the link was issued for.
    // (Guards against the user changing their email after requesting the link.)
    if (String(user.email).toLowerCase() !== String(email).toLowerCase()) {
      return createErrorResponse(
        "This verification link is no longer valid for your current email",
        400
      );
    }

    user.emailVerified = new Date();
    await user.save();

    await markTokenAsUsed(token);

    return createSuccessResponse(
      { message: "Email verified successfully", email: user.email },
      "Your email address has been verified"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
