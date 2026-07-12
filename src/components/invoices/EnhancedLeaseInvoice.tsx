"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Download,
  Mail,
  Printer,
  Save,
  Share2,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeaseInvoice } from "./LeaseInvoice";
import { LeaseResponse } from "@/lib/services/lease.service";
import {
  emailInvoicePDF,
  generateLeaseInvoicePDF,
  saveInvoiceToDocuments,
  InvoiceGenerationOptions,
} from "@/lib/invoice-pdf-generator";
import {
  printInvoiceDirect,
  downloadInvoiceAsPDFDirect,
  type PrintableInvoice,
} from "@/lib/invoice-print";
import { buildPrintableInvoiceFromLease } from "@/lib/invoice/invoice-builders";

export interface EnhancedLeaseInvoiceProps {
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
  onInvoiceGenerated?: (fileName: string) => void;
  onInvoiceEmailed?: (email: string) => void;
  onInvoiceSaved?: (documentId: string) => void;
}

export function EnhancedLeaseInvoice({
  lease,
  companyInfo,
  invoiceNumber,
  issueDate,
  dueDate,
  className,
  onInvoiceGenerated,
  onInvoiceEmailed,
  onInvoiceSaved,
}: EnhancedLeaseInvoiceProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Email form state
  const [emailTo, setEmailTo] = useState(lease.tenantId?.userId?.email || "");
  const [emailSubject, setEmailSubject] = useState(
    `Lease Invoice - ${lease.propertyId?.name || "Property"}`
  );
  const [emailMessage, setEmailMessage] = useState(
    `Dear ${
      lease.tenantId?.userId?.firstName || "Tenant"
    },\n\nPlease find attached your lease invoice for ${
      lease.propertyId?.name || "the property"
    }.\n\nBest regards,\n${companyInfo?.name || "PropertyPro Management"}`
  );

  // Build a PrintableInvoice from lease data (keeps print and download identical)
  const buildPrintableFromLease = (): PrintableInvoice =>
    buildPrintableInvoiceFromLease(lease, {
      companyInfo,
      invoiceNumber,
      issueDate,
      dueDate,
    }) as PrintableInvoice;

  // Generate PDF and download using the same HTML design
  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      const printable = buildPrintableFromLease();
      await downloadInvoiceAsPDFDirect(printable, companyInfo);
      toast.success("Invoice downloaded");
      onInvoiceGenerated?.(String(printable.invoiceNumber));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to download invoice";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Email PDF directly (server will generate PDF)
  const handleEmailPDF = async () => {
    try {
      setIsEmailing(true);

      const emailResult = await emailInvoicePDF({
        to: emailTo,
        subject: emailSubject,
        message: emailMessage,
        leaseId: lease._id,
        invoiceNumber: invoiceNumber,
      });

      if (emailResult.success) {
        toast.success(`Invoice emailed to ${emailTo}`);
        onInvoiceEmailed?.(emailTo);
        setEmailDialogOpen(false);
      } else {
        throw new Error(emailResult.error || "Failed to send email");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to email invoice";
      toast.error(errorMessage);
    } finally {
      setIsEmailing(false);
    }
  };

  // Generate PDF and save to documents
  const handleSavePDF = async () => {
    try {
      setIsSaving(true);

      const options: InvoiceGenerationOptions = {
        lease,
        companyInfo,
        invoiceNumber,
        issueDate,
        dueDate,
        includeTerms: true,
        includeNotes: true,
      };

      const result = await generateLeaseInvoicePDF(options);

      if (result.success) {
        const saveResult = await saveInvoiceToDocuments(result, lease._id);

        if (saveResult.success && saveResult.documentId) {
          toast.success("Invoice saved to documents");
          onInvoiceSaved?.(saveResult.documentId);
        } else {
          throw new Error(saveResult.error || "Failed to save document");
        }
      } else {
        throw new Error(result.error || "Failed to generate PDF");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save invoice";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Print invoice using the same HTML design
  const handlePrint = async () => {
    const printable = buildPrintableFromLease();
    await printInvoiceDirect(printable, companyInfo);
  };

  // Copy share link
  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/dashboard/leases/${
      lease._id || "unknown"
    }/invoice`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
    setShareDialogOpen(false);
  };

  return (
    <div className={className}>
      {/* Action Bar */}
      <Card className="mb-6 print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {/* Print Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>

            {/* Download PDF Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isGenerating ? "Generating..." : "Download PDF"}
            </Button>

            {/* Email Button */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Email Invoice</DialogTitle>
                  <DialogDescription>
                    Send the invoice PDF via email
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email-to">To</Label>
                    <Input
                      id="email-to"
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email subject"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-message">Message</Label>
                    <Textarea
                      id="email-message"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Email message"
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEmailDialogOpen(false)}
                    disabled={isEmailing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEmailPDF}
                    disabled={isEmailing || !emailTo}
                  >
                    {isEmailing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    {isEmailing ? "Sending..." : "Send Email"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Save Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSavePDF}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Saving..." : "Save to Documents"}
            </Button>

            {/* Share Button */}
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share Invoice</DialogTitle>
                  <DialogDescription>
                    Share a link to this invoice
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Share Link</Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/dashboard/leases/${
                          lease._id || "unknown"
                        }/invoice`}
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyShareLink}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShareDialogOpen(false)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Component */}
      <LeaseInvoice
        lease={lease}
        companyInfo={companyInfo}
        invoiceNumber={invoiceNumber}
        issueDate={issueDate}
        dueDate={dueDate}
      />
    </div>
  );
}
