"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Email form state
  const [emailTo, setEmailTo] = useState(lease.tenantId?.userId?.email || "");
  const [emailSubject, setEmailSubject] = useState(
    `Facture de location - ${lease.propertyId?.name || "Bien"}`
  );
  const [emailMessage, setEmailMessage] = useState(
    `Bonjour ${
      lease.tenantId?.userId?.firstName || "Locataire"
    },\n\nVeuillez trouver ci-joint votre facture de location pour ${
      lease.propertyId?.name || "le bien"
    }.\n\nCordialement,\n${companyInfo?.name || "GESTION E-IMMO"}`
  );

  const openStoredInvoiceIfAvailable = async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/invoices?leaseId=${encodeURIComponent(String(lease._id))}&limit=1&includeSettled=true`,
        { cache: "no-store" },
      );
      if (!response.ok) return false;

      const payload = await response.json();
      const rows = payload?.data?.invoices || payload?.data;
      const invoice = Array.isArray(rows) ? rows[0] : null;
      if (!invoice?._id) return false;

      router.push(`/dashboard/accounting/invoices/${invoice._id}`);
      return true;
    } catch {
      return false;
    }
  };

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
      if (await openStoredInvoiceIfAvailable()) return;
      const printable = buildPrintableFromLease();
      await downloadInvoiceAsPDFDirect(printable, companyInfo);
      toast.success("Facture téléchargée");
      onInvoiceGenerated?.(String(printable.invoiceNumber));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Échec du téléchargement de la facture";
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
        toast.success(`Facture envoyée à ${emailTo}`);
        onInvoiceEmailed?.(emailTo);
        setEmailDialogOpen(false);
      } else {
        throw new Error(emailResult.error || "Échec de l'envoi de l'e-mail");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Échec de l'envoi de la facture";
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
          toast.success("Facture enregistrée dans les documents");
          onInvoiceSaved?.(saveResult.documentId);
        } else {
          throw new Error(saveResult.error || "Échec de l'enregistrement du document");
        }
      } else {
        throw new Error(result.error || "Échec de la génération du PDF");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Échec de l'enregistrement de la facture";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Imprimer invoice using the same HTML design
  const handlePrint = async () => {
    if (await openStoredInvoiceIfAvailable()) return;
    const printable = buildPrintableFromLease();
    await printInvoiceDirect(printable, companyInfo);
  };

  // Copy share link
  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/dashboard/leases/${
      lease._id || "unknown"
    }/invoice`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien de partage copié");
    setShareDialogOpen(false);
  };

  return (
    <div className={className}>
      {/* Action Bar */}
      <Card className="mb-6 print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Actions sur la facture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {/* Imprimer Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>

            {/* Télécharger le PDF Button */}
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
              {isGenerating ? "Génération..." : "Télécharger le PDF"}
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
                  E-mail
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Envoyer la facture</DialogTitle>
                  <DialogDescription>
                    Envoyer la facture PDF par e-mail
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email-to">À</Label>
                    <Input
                      id="email-to"
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="destinataire@exemple.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Objet</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Objet de l'e-mail"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-message">Message</Label>
                    <Textarea
                      id="email-message"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Message de l'e-mail"
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
                    Annuler
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
                    {isEmailing ? "Envoi..." : "Envoyer"}
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
              {isSaving ? "Enregistrement..." : "Enregistrer dans les documents"}
            </Button>

            {/* Partager Button */}
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Partager
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Partager la facture</DialogTitle>
                  <DialogDescription>
                    Partager un lien vers cette facture
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Lien de partage</Label>
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
                    Fermer
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
