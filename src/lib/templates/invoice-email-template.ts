/**
 * PropertyPro - Invoice Email Template
 * Shared HTML template for emailing invoices to tenants
 */

interface InvoiceEmailTemplateOptions {
  message: string;
  propertyName?: string;
  tenantName?: string;
  invoiceNumber?: string;
  amountDue?: number;
  dueDate?: Date;
  currencyCode?: string;
}
import { formatCurrency } from "@/lib/utils/formatting";

// const formatCurrency = (amount: number) =>
//   new Intl.NumberFormat("en-US", {
//     style: "currency",
//     currency: "USD",
//   }).format(amount);

export function buildInvoiceEmailHtml(
  options: InvoiceEmailTemplateOptions
): string {
  const {
    message,
    propertyName = "Property",
    tenantName = "Tenant",
    invoiceNumber,
    amountDue,
    dueDate,
    currencyCode,
  } = options;

  const messageHtml = (message || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("<br>");

  const amountHtml =
    typeof amountDue === "number"
      ? `<p style="margin: 5px 0;"><strong>Total Due:</strong> ${formatCurrency(
          amountDue,
          currencyCode
        )}</p>`
      : "";

  const dueDateHtml = dueDate
    ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>`
    : "";

  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">PropertyPro</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Property Management System</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Lease Invoice</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            ${messageHtml}
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1976d2; margin: 0 0 10px 0;">Invoice Details</h3>
            <p style="margin: 5px 0;"><strong>Property:</strong> ${propertyName}</p>
            <p style="margin: 5px 0;"><strong>Tenant:</strong> ${tenantName}</p>
            ${
              invoiceNumber
                ? `<p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>`
                : ""
            }
            ${amountHtml}
            ${dueDateHtml}
            <p style="margin: 5px 0;"><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #e65100;">
              <strong>📎 Attachment:</strong> Your lease invoice is attached as a PDF document.
            </p>
          </div>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.APP_URL || "#"}/dashboard" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
              Access Your Portal
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #666; font-size: 14px;">
            <p>If you have any questions about this invoice, please contact your property manager or reply to this email.</p>
            <p style="margin-bottom: 0;">Best regards,<br>PropertyPro Management Team</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>This email was sent from PropertyPro Property Management System.</p>
          <p>© ${new Date().getFullYear()} PropertyPro. All rights reserved.</p>
        </div>
      </div>
    `;
}
