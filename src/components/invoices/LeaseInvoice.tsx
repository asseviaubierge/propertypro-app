"use client";

import React, { useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Calendar,
  DollarSign,
  Download,
  FileText,
  Home,
  Mail,
  MapPin,
  Phone,
  Printer,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LeaseResponse } from "@/lib/services/lease.service";
import { LeaseStatus } from "@/types";
import { cn } from "@/lib/utils";
import { deriveCompanyInitials } from "@/lib/invoice/logo-utils";
import {
  downloadInvoiceAsPDFDirect,
  printInvoiceDirect,
  type PrintableInvoice,
} from "@/lib/invoice-print";
import { buildPrintableInvoiceFromLease } from "@/lib/invoice/invoice-builders";
import "../../styles/invoice-print.css";

import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

export interface LeaseInvoiceProps {
  lease: LeaseResponse;
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo?: string;
  };
  invoiceNumber?: string;
  issueDate?: Date;
  dueDate?: Date;
  className?: string;
}

export function LeaseInvoice({
  lease,
  companyInfo = {
    name: "PropertyPro Management",
    address: "123 Business Ave, Suite 100, City, State 12345",
    phone: "+1 (555) 123-4567",
    email: "info@PropertyPro.com",
    website: "www.PropertyPro.com",
  },
  invoiceNumber,
  issueDate,
  dueDate,
  className,
}: LeaseInvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { formatCurrency, formatDate } = useLocalizationContext();

  const resolvedIssueDate = useMemo(() => {
    if (issueDate instanceof Date) return issueDate;
    if (typeof issueDate === "string") return new Date(issueDate);
    return new Date();
  }, [issueDate]);

  const resolvedDueDate = useMemo(() => {
    if (dueDate instanceof Date) return dueDate;
    if (typeof dueDate === "string") return new Date(dueDate);
    return new Date(resolvedIssueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }, [dueDate, resolvedIssueDate]);

  const printableInvoice = useMemo(
    () =>
      buildPrintableInvoiceFromLease(lease, {
        companyInfo,
        invoiceNumber,
        issueDate: resolvedIssueDate,
        dueDate: resolvedDueDate,
      }) as PrintableInvoice,
    [lease, companyInfo, invoiceNumber, resolvedIssueDate, resolvedDueDate]
  );

  const generatedInvoiceNumber = printableInvoice.invoiceNumber;
  const companyInitials = useMemo(
    () => deriveCompanyInitials(companyInfo.name),
    [companyInfo.name]
  );

  // Format currency
  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };


  // Calculate lease duration
  const calculateDuration = () => {
    const start = new Date(lease.startDate);
    const end = new Date(lease.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;

    if (months > 0) {
      return days > 0 ? `${months} months, ${days} days` : `${months} months`;
    }
    return `${days} days`;
  };

  // Get status color
  const getStatusColor = (status: LeaseStatus) => {
    switch (status) {
      case LeaseStatus.ACTIVE:
        return "bg-green-100 text-green-800 border-green-200";
      case LeaseStatus.PENDING:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case LeaseStatus.EXPIRED:
        return "bg-red-100 text-red-800 border-red-200";
      case LeaseStatus.TERMINATED:
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const handlePrint = async () => {
    try {
      await printInvoiceDirect(printableInvoice, companyInfo);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to open print dialog. Please check your popup blocker.";
      toast.error(errorMessage);
    }
  };

  // Generate HTML content for the invoice
  // Download as PDF using direct jsPDF rendering
  const handleDownload = async () => {
    try {
      setIsGeneratingPDF(true);
      await downloadInvoiceAsPDFDirect(printableInvoice, companyInfo);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to download invoice PDF. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      {/* Action Buttons */}
      {/* <div className="flex justify-end gap-2 mb-6 print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isGeneratingPDF}
          className="flex items-center gap-2"
        >
          {isGeneratingPDF ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div> */}

      {/* Invoice Content */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8" ref={invoiceRef}>
          <div className="print-container">
            {/* Header */}
            <div className="header flex justify-between items-start mb-8">
              <div className="company-info">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-lg overflow-hidden",
                      companyInfo.logo
                        ? "bg-white ring-1 ring-slate-200"
                        : "bg-emerald-500"
                    )}
                  >
                    {companyInfo.logo ? (
                      <img
                        src={companyInfo.logo}
                        alt={companyInfo.name}
                        className="h-full w-full object-contain"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-lg font-semibold text-white">
                        {companyInitials}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {companyInfo.name}
                  </h1>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {companyInfo.address}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {companyInfo.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {companyInfo.email}
                  </p>
                  {companyInfo.website && (
                    <p className="text-blue-600">{companyInfo.website}</p>
                  )}
                </div>
              </div>

              <div className="invoice-info text-right">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  LEASE INVOICE
                </h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">Invoice #:</span>{" "}
                    {generatedInvoiceNumber}
                  </p>
                  <p>
                    <span className="font-medium">Issue Date:</span>{" "}
                    {formatDate(resolvedIssueDate)}
                  </p>
                  <p>
                    <span className="font-medium">Due Date:</span>{" "}
                    {formatDate(resolvedDueDate)}
                  </p>
                  <div className="mt-2">
                    <Badge
                      className={cn(
                        "status-badge",
                        getStatusColor(lease.status)
                      )}
                    >
                      {lease.status?.replace("_", " ") || "N/A"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="mb-8" />

            {/* Parties Information */}
            <div className="parties grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Property Information */}
              <div className="party">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                  <Home className="h-5 w-5 text-blue-600" />
                  Property Information
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">
                    {lease.propertyId?.name || "N/A"}
                  </p>
                  <p className="text-gray-600">
                    {lease.propertyId?.address?.street || "N/A"}
                  </p>
                  <p className="text-gray-600">
                    {lease.propertyId?.address?.city || "N/A"},{" "}
                    {lease.propertyId?.address?.state || "N/A"}{" "}
                    {lease.propertyId?.address?.zipCode || "N/A"}
                  </p>
                  <div className="mt-3 space-y-1">
                    <p className="text-gray-600">
                      <span className="font-medium">Type:</span>{" "}
                      {lease.propertyId?.type || "N/A"}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Bedrooms:</span>{" "}
                      {lease.propertyId?.bedrooms || "N/A"}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Bathrooms:</span>{" "}
                      {lease.propertyId?.bathrooms || "N/A"}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Square Feet:</span>{" "}
                      {lease.propertyId?.squareFootage?.toLocaleString() ||
                        "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tenant Information */}
              <div className="party">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                  <User className="h-5 w-5 text-blue-600" />
                  Tenant Information
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">
                    {lease.tenantId?.userId?.firstName || "N/A"}{" "}
                    {lease.tenantId?.userId?.lastName || ""}
                  </p>
                  <p className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    {lease.tenantId?.userId?.email || "N/A"}
                  </p>
                  {lease.tenantId?.userId?.phone && (
                    <p className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      {lease.tenantId?.userId?.phone}
                    </p>
                  )}
                  <div className="mt-3">
                    <p className="text-gray-600">
                      <span className="font-medium">Tenant ID:</span>{" "}
                      {lease.tenantId?._id || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lease Details */}
            <div className="lease-details bg-gray-50 p-6 rounded-lg mb-8">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                Lease Details
              </h3>
              <div className="details-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    Lease ID:
                  </span>
                  <span className="detail-value text-gray-600">
                    {lease._id}
                  </span>
                </div>
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    Status:
                  </span>
                  <Badge
                    className={cn("text-xs", getStatusColor(lease.status))}
                  >
                    {lease.status?.replace("_", " ") || "N/A"}
                  </Badge>
                </div>
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    Start Date:
                  </span>
                  <span className="detail-value text-gray-600">
                    {formatDate(lease.startDate)}
                  </span>
                </div>
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    End Date:
                  </span>
                  <span className="detail-value text-gray-600">
                    {formatDate(lease.endDate)}
                  </span>
                </div>
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    Duration:
                  </span>
                  <span className="detail-value text-gray-600">
                    {calculateDuration()}
                  </span>
                </div>
                {lease.signedDate && (
                  <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                    <span className="detail-label font-medium text-gray-700">
                      Signed Date:
                    </span>
                    <span className="detail-value text-gray-600">
                      {formatDate(lease.signedDate)}
                    </span>
                  </div>
                )}
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    Created:
                  </span>
                  <span className="detail-value text-gray-600">
                    {formatDate(lease.createdAt)}
                  </span>
                </div>
                <div className="detail-item flex justify-between py-2 border-b border-gray-200">
                  <span className="detail-label font-medium text-gray-700">
                    Last Updated:
                  </span>
                  <span className="detail-value text-gray-600">
                    {formatDate(lease.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="financial-summary bg-blue-50 p-6 rounded-lg mb-8">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Financial Summary
              </h3>
              <div className="summary-grid space-y-3">
                <div className="summary-item flex justify-between py-3 border-b border-blue-200">
                  <span className="summary-label font-medium text-blue-900">
                    Monthly Rent:
                  </span>
                  <span className="summary-value font-semibold text-blue-900">
                    {formatCurrency(lease.terms?.rentAmount || 0)}
                  </span>
                </div>
                <div className="summary-item flex justify-between py-3 border-b border-blue-200">
                  <span className="summary-label font-medium text-blue-900">
                    Security Deposit:
                  </span>
                  <span className="summary-value font-semibold text-blue-900">
                    {formatCurrency(lease.terms?.securityDeposit || 0)}
                  </span>
                </div>
                <div className="summary-item flex justify-between py-3 border-b border-blue-200">
                  <span className="summary-label font-medium text-blue-900">
                    Late Fee:
                  </span>
                  <span className="summary-value font-semibold text-blue-900">
                    {formatCurrency(lease.terms?.lateFee || 0)}
                  </span>
                </div>
                {lease.terms?.petDeposit && lease.terms?.petDeposit > 0 && (
                  <div className="summary-item flex justify-between py-3 border-b border-blue-200">
                    <span className="summary-label font-medium text-blue-900">
                      Pet Deposit:
                    </span>
                    <span className="summary-value font-semibold text-blue-900">
                      {formatCurrency(lease.terms?.petDeposit || 0)}
                    </span>
                  </div>
                )}

                {/* Total Initial Payment */}
                <div className="total-row summary-item flex justify-between py-3 border-t-2 border-blue-600 mt-4">
                  <span className="summary-label font-bold text-blue-900 text-lg">
                    Total Initial Payment:
                  </span>
                  <span className="summary-value font-bold text-blue-900 text-lg">
                    {formatCurrency(
                      (lease.terms?.rentAmount || 0) +
                        (lease.terms?.securityDeposit || 0) +
                        (lease.terms?.petDeposit || 0) +
                        (lease.terms?.lateFee || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Lease Terms & Conditions */}
            {(lease.terms?.utilities?.length > 0 ||
              lease.terms?.restrictions?.length > 0) && (
              <div className="lease-terms bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Terms & Conditions
                </h3>

                {lease.terms?.utilities?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">
                      Utilities Included:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {lease.terms?.utilities?.map((utility, index) => (
                        <li key={index}>{utility}</li>
                      )) || <li>None specified</li>}
                    </ul>
                  </div>
                )}

                {lease.terms?.restrictions?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">
                      Restrictions:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {lease.terms?.restrictions?.map((restriction, index) => (
                        <li key={index}>{restriction}</li>
                      )) || <li>None specified</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Renewal Options */}
            {lease.renewalOptions?.available && (
              <div className="renewal-options bg-green-50 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Renewal Options
                </h3>
                <p className="text-sm text-gray-600">
                  This lease is eligible for renewal.
                </p>
                {lease.renewalOptions?.terms && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">Terms:</span>{" "}
                    {lease.renewalOptions?.terms}
                  </p>
                )}
              </div>
            )}

            {/* Additional Notes */}
            {lease.notes && (
              <div className="notes bg-yellow-50 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Additional Notes
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {lease.notes}
                </p>
              </div>
            )}

            {/* Documents */}
            {lease.documents?.length > 0 && (
              <div className="documents bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Associated Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lease.documents?.map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Document {index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="footer text-center text-gray-500 text-sm mt-12 pt-6 border-t border-gray-200">
              <p className="mb-2">
                This invoice was generated on {formatDate(new Date())} by
                PropertyPro Management System
              </p>
              <p className="mb-2">
                For questions regarding this invoice, please contact us at{" "}
                {companyInfo.email} or {companyInfo.phone}
              </p>
              <p className="text-xs">
                Invoice #{generatedInvoiceNumber} | Lease ID: {lease._id}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
