/**
 * PropertyPro - Company Info Defaults
 * Shared default company information for PDF generation
 * Provides consistent fallback values across the application
 */

import { InvoiceCompanyInfo } from "@/lib/invoice/invoice-shared";
import { ReceiptCompanyInfo } from "@/lib/invoice/receipt-renderer";

/**
 * Default company information used as fallback when company settings are not available
 * This ensures PDFs always have valid company info even if settings haven't been configured
 */
export const DEFAULT_COMPANY_INFO: InvoiceCompanyInfo = {
  name: "PropertyPro Management",
  address: "123 Business Avenue, Suite 100, City, State 12345",
  phone: "+1 (555) 123-4567",
  email: "info@propertypro.com",
  website: "www.propertypro.com",
};

/**
 * Default company information for receipts
 * Uses the same values as invoice defaults for consistency
 */
export const DEFAULT_RECEIPT_COMPANY_INFO: ReceiptCompanyInfo = {
  name: DEFAULT_COMPANY_INFO.name,
  address: DEFAULT_COMPANY_INFO.address,
  phone: DEFAULT_COMPANY_INFO.phone,
  email: DEFAULT_COMPANY_INFO.email,
  website: DEFAULT_COMPANY_INFO.website,
};

/**
 * Merge user-provided company info with defaults
 * Ensures all required fields are present
 */
export function mergeWithDefaults(
  userInfo?: Partial<InvoiceCompanyInfo>
): InvoiceCompanyInfo {
  if (!userInfo) {
    return { ...DEFAULT_COMPANY_INFO };
  }

  return {
    name: userInfo.name || DEFAULT_COMPANY_INFO.name,
    address: userInfo.address || DEFAULT_COMPANY_INFO.address,
    phone: userInfo.phone || DEFAULT_COMPANY_INFO.phone,
    email: userInfo.email || DEFAULT_COMPANY_INFO.email,
    website: userInfo.website || DEFAULT_COMPANY_INFO.website,
    logo: userInfo.logo,
  };
}

/**
 * Merge user-provided receipt company info with defaults
 */
export function mergeReceiptCompanyWithDefaults(
  userInfo?: Partial<ReceiptCompanyInfo>
): ReceiptCompanyInfo {
  if (!userInfo) {
    return { ...DEFAULT_RECEIPT_COMPANY_INFO };
  }

  return {
    name: userInfo.name || DEFAULT_RECEIPT_COMPANY_INFO.name,
    address: userInfo.address || DEFAULT_RECEIPT_COMPANY_INFO.address,
    phone: userInfo.phone || DEFAULT_RECEIPT_COMPANY_INFO.phone,
    email: userInfo.email || DEFAULT_RECEIPT_COMPANY_INFO.email,
    website: userInfo.website || DEFAULT_RECEIPT_COMPANY_INFO.website,
    logo: userInfo.logo,
  };
}

