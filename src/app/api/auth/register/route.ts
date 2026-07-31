/**
 * PropertyPro - User Registration API Route
 * Handle user registration with validation and role assignment
 */

import { NextRequest } from "next/server";
import { User } from "@/models";
import { UserRole } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  withDatabase,
} from "@/lib/api-utils";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/utils";
import {
  createEmailVerificationToken,
  sendEmailVerificationLink,
} from "@/lib/invitation-utils";

// ============================================================================
// POST /api/auth/register - Register a new user
// ============================================================================

export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      console.error("Failed to parse request body:", error);
      return createErrorResponse(error!, 400);
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role = UserRole.TENANT,
      avatar,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      console.error("Missing required fields:", {
        firstName: !!firstName,
        lastName: !!lastName,
        email: !!email,
        password: !!password,
      });
      return createErrorResponse("Missing required fields", 400);
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return createErrorResponse("Invalid email format", 400);
    }

    // Validate password length
    if (password.length < 6) {
      console.error("Password too short:", password.length);
      return createErrorResponse(
        "Password must be at least 6 characters long",
        400
      );
    }

    // Map role values to enum values for single company architecture
    const roleMapping: Record<string, UserRole> = {
      tenant: UserRole.TENANT,
      admin: UserRole.ADMIN,
      manager: UserRole.MANAGER,
      // Legacy mappings for backward compatibility
      super_admin: UserRole.ADMIN,
      property_manager: UserRole.MANAGER,
      owner: UserRole.MANAGER,
      landlord: UserRole.MANAGER,
      property_owner: UserRole.MANAGER,
      "Property Owner": UserRole.MANAGER,
      "Property Manager": UserRole.MANAGER,
      maintenance_staff: UserRole.MANAGER,
      "Maintenance Staff": UserRole.MANAGER,
      leasing_agent: UserRole.MANAGER,
      "Leasing Agent": UserRole.MANAGER,
    };

    const mappedRole = roleMapping[role] || role;

    // Validate role
    if (!Object.values(UserRole).includes(mappedRole)) {
      console.error(
        "Invalid role specified:",
        role,
        "Available roles:",
        Object.values(UserRole)
      );
      return createErrorResponse(`Invalid role specified: ${role}`, 400);
    }

    // Validate phone number if provided
    if (phone) {
      if (!isValidPhoneNumber(phone)) {
        return createErrorResponse("Invalid phone number format", 400);
      }
    }

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return createErrorResponse("User with this email already exists", 409);
      }

      // Create new user
      const newUser = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone ? normalizePhoneNumber(phone.trim()) : undefined,
        password,
        role: mappedRole,
        avatar: avatar || null,
        isActive: true,
        emailVerified: null, // Will be set when email is verified
      });

      // Save user (password will be hashed by pre-save middleware)
      const savedUser = await newUser.save();
      // Start email verification automatically after registration.
// Registration remains successful even if sending the email fails.
try {
  const tokenResult = await createEmailVerificationToken(
    savedUser._id.toString(),
    savedUser.email
  );

  if (tokenResult.success && tokenResult.token) {
    const userName =
      `${savedUser.firstName} ${savedUser.lastName}`.trim();

    const sendResult = await sendEmailVerificationLink(
      tokenResult.token,
      userName
    );

    if (!sendResult.success) {
      console.error(
        "Registration succeeded, but verification email could not be sent:",
        sendResult.error
      );
    }
  } else {
    console.error(
      "Registration succeeded, but verification token could not be created:",
      tokenResult.error
    );
  }
} catch (emailError) {
  console.error(
    "Registration succeeded, but automatic email verification failed:",
    emailError
  );
}
      // Remove password from response
      const userResponse = savedUser.toJSON();
      delete userResponse.password;

      return createSuccessResponse(
        {
          user: userResponse,
          message: "Registration successful",
        },
        "User registered successfully"
      );
    } catch (error: any) {
      // Handle duplicate email error
      if (
        error.code === 11000 ||
        error.message.includes("Email already exists")
      ) {
        return createErrorResponse("User with this email already exists", 409);
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        return createErrorResponse(
          `Validation error: ${validationErrors.join(", ")}`,
          400
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Registration error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// GET /api/auth/register - Get registration information (for testing)
// ============================================================================

export const GET = async () => {
  return createSuccessResponse(
    {
      message: "Registration endpoint is available",
      availableRoles: Object.values(UserRole),
      requirements: {
        firstName: "Required, max 50 characters",
        lastName: "Required, max 50 characters",
        email: "Required, valid email format",
        password: "Required, minimum 6 characters",
        phone: "Optional, valid phone number format",
        role: `Optional, one of: ${Object.values(UserRole).join(", ")}`,
      },
    },
    "Registration endpoint information"
  );
};
