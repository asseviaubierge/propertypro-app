/**
 * PropertyPro - Company Info Utility
 * Fetch company information from display settings for invoices and documents
 */

import { InvoiceCompanyInfo } from "@/lib/invoice/invoice-shared";

export interface CompanyInfo extends InvoiceCompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
}

// Cache for company info (client-side only)
let companyInfoCache: CompanyInfo | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
let pendingRequest: Promise<CompanyInfo | null> | null = null;

/**
 * Fetch company information from display settings (client-side)
 * Results are cached for 5 minutes to prevent excessive API calls
 */
export async function getCompanyInfo(): Promise<CompanyInfo | null> {
  // Return cached data if still valid
  if (companyInfoCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return companyInfoCache;
  }

  // If a request is already in flight, wait for it
  if (pendingRequest) {
    return pendingRequest;
  }

  // Create a new request
  pendingRequest = fetchCompanyInfo();

  try {
    const result = await pendingRequest;
    return result;
  } finally {
    pendingRequest = null;
  }
}

/**
 * Clear the company info cache (useful when settings are updated)
 */
export function clearCompanyInfoCache(): void {
  companyInfoCache = null;
  cacheTimestamp = 0;
}

async function fetchCompanyInfo(): Promise<CompanyInfo | null> {
  try {
    // Fetch display settings for branding info
    const displayResponse = await fetch("/api/settings/display");
    if (!displayResponse.ok) {
      console.error("Failed to fetch display settings");
      return null;
    }

    const displayData = await displayResponse.json();
    const displaySettings =
      displayData?.data?.settings || displayData?.settings;

    // Fetch profile settings for contact info
    const profileResponse = await fetch("/api/settings/profile");
    const profileData = await profileResponse.json();
    const profileSettings =
      profileData?.data?.settings || profileData?.settings;

    if (!displaySettings?.branding) {
      return null;
    }

    const { companyName, companyAddress } = displaySettings.branding;

    if (!companyName && !companyAddress) {
      return null;
    }

    const result: CompanyInfo = {
      name: companyName || "PropertyPro",
      address: companyAddress || "",
      phone: profileSettings?.phone || "",
      email: profileSettings?.email || "",
      website: profileSettings?.website || "",
      logo:
        displaySettings.branding.favicon || displaySettings.branding.logoLight,
    };

    // Update cache
    companyInfoCache = result;
    cacheTimestamp = Date.now();

    return result;
  } catch (error) {
    console.error("Error fetching company info:", error);
    return null;
  }
}

/**
 * Fetch company information from display settings (server-side)
 */
export async function getCompanyInfoServer(): Promise<CompanyInfo | null> {
  try {
    const { default: DisplaySettings } = await import(
      "@/models/DisplaySettings"
    );
    const { default: ProfileSettings } = await import(
      "@/models/ProfileSettings"
    );
    const { default: User } = await import("@/models/User");
    const { UserRole } = await import("@/types");

    // Find admin user
    const admin = await User.findOne({
      role: UserRole.ADMIN,
      isActive: true,
    })
      .select("_id")
      .lean();

    if (!admin?._id) {
      return null;
    }

    const adminId = admin._id.toString();

    // Get display settings for admin (branding info)
    const displaySettings = await DisplaySettings.findByUserId(adminId);

    // Get profile settings for admin (contact info)
    const profileSettings = await ProfileSettings.findOne({
      userId: adminId,
    }).lean();

    if (!displaySettings?.branding) {
      return null;
    }

    const { companyName, companyAddress } = displaySettings.branding;

    if (!companyName && !companyAddress) {
      return null;
    }

    return {
      name: companyName || "PropertyPro",
      address: companyAddress || "",
      phone: profileSettings?.phone || "",
      email: profileSettings?.email || "",
      website: profileSettings?.website || "",
      logo:
        displaySettings.branding.favicon || displaySettings.branding.logoLight,
    };
  } catch (error) {
    console.error("Error fetching company info (server):", error);
    return null;
  }
}

/**
 * Get default company info (fallback)
 */
export function getDefaultCompanyInfo(): CompanyInfo {
  return {
    name: "PropertyPro",
    address: "",
    phone: "",
    email: "",
    website: "",
    logo: "/images/logo-light.png",
  };
}
