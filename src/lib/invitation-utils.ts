/**
 * PropertyPro - Invitation Utilities
 * Utility functions for managing password reset tokens
 */

import crypto from "crypto";
import InvitationToken, { IInvitationToken } from "@/models/InvitationToken";
import connectDB from "@/lib/mongodb";
import { emailService } from "@/lib/email-service";

// Generate secure random token
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Create password reset token
export async function createPasswordResetToken(
  userId: string,
  email: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    await connectDB();

    // Remove any existing password reset tokens for this user
    await InvitationToken.deleteMany({
      userId,
      type: "password_reset",
    });

    // Generate secure token
    const token = generateSecureToken();

    // Create password reset token (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const resetToken = new InvitationToken({
      email: email.toLowerCase(),
      token,
      type: "password_reset",
      userId,
      invitedBy: userId, // Self-initiated
      expiresAt,
      isUsed: false,
    });

    await resetToken.save();

    return {
      success: true,
      token,
    };
  } catch (error) {
    console.error("Error creating password reset token:", error);
    return {
      success: false,
      error: "Failed to create password reset token",
    };
  }
}

// Send password reset email
export async function sendPasswordResetEmail(
  token: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB();

    // Find the reset token
    const resetToken = await InvitationToken.findOne({
      token,
      type: "password_reset",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetToken) {
      return {
        success: false,
        error: "Invalid or expired reset token",
      };
    }

    // Send password reset email
    const emailSent = await emailService.sendPasswordReset(
      resetToken.email,
      userName,
      token
    );

    if (!emailSent) {
      return {
        success: false,
        error: "Failed to send password reset email",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return {
      success: false,
      error: "Failed to send password reset email",
    };
  }
}

// Create email change verification token
export async function createEmailChangeToken(
  userId: string,
  newEmail: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    await connectDB();

    // Remove any existing email change tokens for this user
    await InvitationToken.deleteMany({
      userId,
      type: "email_change",
    });

    const token = generateSecureToken();

    // Email change token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const changeToken = new InvitationToken({
      email: newEmail.toLowerCase(), // The address that receives the verification link
      newEmail: newEmail.toLowerCase(),
      token,
      type: "email_change",
      userId,
      invitedBy: userId, // Self-initiated
      expiresAt,
      isUsed: false,
    });

    await changeToken.save();

    return {
      success: true,
      token,
    };
  } catch (error) {
    console.error("Error creating email change token:", error);
    return {
      success: false,
      error: "Failed to create email change token",
    };
  }
}

// Send email change verification to the NEW address
export async function sendEmailChangeVerification(
  token: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB();

    const changeToken = await InvitationToken.findOne({
      token,
      type: "email_change",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!changeToken) {
      return {
        success: false,
        error: "Invalid or expired email change token",
      };
    }

    const emailSent = await emailService.sendEmailChangeVerification(
      changeToken.newEmail!,
      userName,
      token
    );

    if (!emailSent) {
      return {
        success: false,
        error: "Failed to send verification email",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending email change verification:", error);
    return {
      success: false,
      error: "Failed to send verification email",
    };
  }
}

// Create email verification token (verifies the user's CURRENT email)
export async function createEmailVerificationToken(
  userId: string,
  email: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    await connectDB();

    // Remove any existing verification tokens for this user
    await InvitationToken.deleteMany({
      userId,
      type: "email_verification",
    });

    const token = generateSecureToken();

    // Verification token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const verificationToken = new InvitationToken({
      email: email.toLowerCase(),
      token,
      type: "email_verification",
      userId,
      invitedBy: userId, // Self-initiated
      expiresAt,
      isUsed: false,
    });

    await verificationToken.save();

    return { success: true, token };
  } catch (error) {
    console.error("Error creating email verification token:", error);
    return {
      success: false,
      error: "Failed to create email verification token",
    };
  }
}

// Send the verification link to the user's current email
export async function sendEmailVerificationLink(
  token: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB();

    const verificationToken = await InvitationToken.findOne({
      token,
      type: "email_verification",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationToken) {
      return {
        success: false,
        error: "Invalid or expired verification token",
      };
    }

    const emailSent = await emailService.sendEmailVerification(
      verificationToken.email,
      userName,
      token
    );

    if (!emailSent) {
      return {
        success: false,
        error: "Failed to send verification email",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending email verification:", error);
    return {
      success: false,
      error: "Failed to send verification email",
    };
  }
}

// Validate and get invitation token
export async function validateInvitationToken(
  token: string,
  type?:
    | "tenant_invitation"
    | "password_reset"
    | "email_change"
    | "email_verification"
): Promise<{
  success: boolean;
  invitation?: IInvitationToken;
  error?: string;
}> {
  try {
    await connectDB();

    const invitation = await InvitationToken.findValidToken(token, type);

    if (!invitation) {
      return {
        success: false,
        error: "Invalid or expired token",
      };
    }

    return {
      success: true,
      invitation,
    };
  } catch (error) {
    console.error("Error validating invitation token:", error);
    return {
      success: false,
      error: "Failed to validate token",
    };
  }
}

// Mark invitation token as used
export async function markTokenAsUsed(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB();

    const invitation = await InvitationToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invalid or expired token",
      };
    }

    await invitation.markAsUsed();

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error marking token as used:", error);
    return {
      success: false,
      error: "Failed to mark token as used",
    };
  }
}

// Cleanup expired tokens (can be called periodically)
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    await connectDB();
    await InvitationToken.cleanupExpired();
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);
  }
}
