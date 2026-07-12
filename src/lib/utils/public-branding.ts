/**
 * PropertyPro - Public Branding (server-side)
 *
 * Resolves the admin's branding (logo, favicon, colors, company name) WITHOUT
 * authentication. Shared by the public branding API and the PWA manifest so the
 * install name/icon and login page all read from a single source.
 */

import { cache } from "react";
import connectDB from "@/lib/mongodb";
import { DisplaySettings, User } from "@/models";
import { UserRole } from "@/types";

export interface PublicBranding {
  logoLight: string;
  logoDark: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
}

export const DEFAULT_PUBLIC_BRANDING: PublicBranding = {
  logoLight: "/images/logo-light.png",
  logoDark: "/images/logo-dark.png",
  favicon: "/favicon.ico",
  primaryColor: "#3B82F6",
  secondaryColor: "#64748B",
  companyName: "PropertyPro",
};

/**
 * Get the public branding for the instance (the active admin's display
 * settings). Always resolves — falls back to defaults on any error/missing
 * data so callers (manifest, login page) never throw.
 *
 * Wrapped in React `cache` so the multiple per-request callers (layout
 * metadata + viewport, manifest) share a single DB read.
 */
export const getPublicBranding = cache(async (): Promise<PublicBranding> => {
  try {
    await connectDB();

    // Match the authenticated resolver (resolveGlobalDisplayOwnerId): the
    // oldest active admin owns the single global branding, so the login page
    // and PWA manifest stay in sync with what users see inside the app.
    const admin = await User.findOne({
      role: UserRole.ADMIN,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean();

    if (!admin?._id) return DEFAULT_PUBLIC_BRANDING;

    const displaySettings = await DisplaySettings.findOne({
      userId: admin._id,
      isActive: true,
    }).lean();

    const branding = displaySettings?.branding;
    if (!branding) return DEFAULT_PUBLIC_BRANDING;

    return {
      logoLight: branding.logoLight || DEFAULT_PUBLIC_BRANDING.logoLight,
      logoDark: branding.logoDark || DEFAULT_PUBLIC_BRANDING.logoDark,
      favicon: branding.favicon || DEFAULT_PUBLIC_BRANDING.favicon,
      primaryColor: branding.primaryColor || DEFAULT_PUBLIC_BRANDING.primaryColor,
      secondaryColor:
        branding.secondaryColor || DEFAULT_PUBLIC_BRANDING.secondaryColor,
      companyName: branding.companyName || DEFAULT_PUBLIC_BRANDING.companyName,
    };
  } catch (error) {
    console.error("getPublicBranding error:", error);
    return DEFAULT_PUBLIC_BRANDING;
  }
});
