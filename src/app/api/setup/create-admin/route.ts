/**
 * PropertyPro - Create Admin Setup API
 * One-time setup endpoint to create initial super admin user
 */

import { NextRequest } from "next/server";
import { User } from "@/models";
import { UserRole } from "@/types";
import { createSuccessResponse, createErrorResponse } from "@/lib/api-utils";
import connectDB from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Check if any super admin already exists
    const existingSuperAdmin = await User.findOne({
      role: UserRole.ADMIN,
    });
    if (existingSuperAdmin) {
      return createErrorResponse("Super admin already exists", 400);
    }

    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return createErrorResponse("Missing required fields", 400);
    }

    // Check if user with email already exists
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      return createErrorResponse("User with this email already exists", 400);
    }

    // Create admin user
    const adminUser = new User({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password, // Will be hashed by the model
      role: UserRole.ADMIN,
      phone: body.phone || undefined,
      isActive: true,
      emailVerified: new Date(),
    });

    const savedUser = await adminUser.save();

    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    return createSuccessResponse(
      { data: userResponse },
      "Super admin created successfully"
    );
  } catch (error) {
    console.error("Error creating super admin:", error);
    return createErrorResponse("Failed to create super admin", 500);
  }
}
