/**
 * PropertyPro - Public Branding API
 * Returns branding information (logo, company name) without authentication
 * Used for login page and other public-facing pages
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  getPublicBranding,
  DEFAULT_PUBLIC_BRANDING,
} from "@/lib/utils/public-branding";

/**
 * GET /api/branding/public - Get public branding information
 * No authentication required - used for login page
 */
export async function GET() {
  try {
    const branding = await getPublicBranding();
    return NextResponse.json({ success: true, data: branding });
  } catch (error) {
    console.error("Public branding API error:", error);
    // Return default branding on error
    return NextResponse.json({
      success: true,
      data: DEFAULT_PUBLIC_BRANDING,
    });
  }
}
