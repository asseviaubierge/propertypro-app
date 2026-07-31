"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Download,
  Mail,
  Imprimerer,
  Save,
  Partager2,
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
  saveInvoiceÀDocuments,
  InvoiceGenerationOptions,
} from "@/lib/invoice-pdf-generator";
import {
  printInvoiceDirect,
  downloadInvoiceAsPDFDirect,
  type ImprimerableInvoice,
} from "@/lib/invoice-print";
import { buildImprimerableInvoiceFromLease } from "@/lib/invoice/invoice-builders";

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
  const [shareDialogOpen, setPartagerDialogOpen] = useState(false);

  // Email form state
  const [emailÀ, setEmailÀ] = useState(lease.tenantId?.userId?.email || "");
  const [emailObjet, setEmailObjet] = useState(
    `Facture de location - ${lease.propertyId?.name || "Bien"}`
  );
  const [emailMessage, setEmailMessage] = useState(
    `Dear ${
      lease.tenantId?.userId?.firstName || "Locataire"
    },\n\nVeuillez trouver ci-joint votre facture de location pour ${
      lease.propertyId?.name || "le bien"
    }.\n\nCordialement,\n${companyInfo?.name || "BienPro Management"}`
  );

  // Build a ImprimerableInvoice from lease data (keeps print and download identical)
  const buildImprimerableFromLease = (): ImprimerableInvoice =>
    buildImprimerableInvoiceFromLease(lease, {
      companyInfo,
      invoiceNumber,
      issueDate,
      dueDate,
    }) as ImprimerableInvoice;

  // Generate PDF and download using the same HTML design
  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      const printable = buildImprimerableFromLease();
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
        to: emailÀ,
        subject: emailObjet,
        message: emailMessage,
        leaseId: lease._id,
        invoiceNumber: invoiceNumber,
      });

      if (emailResult.success) {
        toast.success(`Facture envoyée à ${emailÀ}`);
        onInvoiceEmailed?.(emailÀ);
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
        const saveResult = await saveInvoiceÀDocuments(result, lease._id);

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
  const handleImprimer = async () => {
    const printable = buildImprimerableFromLease();
    await printInvoiceDirect(printable, companyInfo);
  };

  // Copy share link
  const handleCopyPartagerLink = () => {
    const shareUrl = `${window.location.origin}/dashboard/leases/${
      lease._id || "unknown"
    }/invoice`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien de partage copié");
    setPartagerDialogOpen(false);
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
              onClick={handleImprimer}
              className="flex items-center gap-2"
            >
              <Imprimerer className="h-4 w-4" />
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
                  Email
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
                      value={emailÀ}
                      onChange={(e) => setEmailÀ(e.target.value)}
                      placeholder="destinataire@exemple.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Objet</Label>
                    <Input
                      id="email-subject"
                      value={emailObjet}
                      onChange={(e) => setEmailObjet(e.target.value)}
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
                    disabled={isEmailing || !emailÀ}
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
            <Dialog open={shareDialogOpen} onOpenChange={setPartagerDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Partager2 className="h-4 w-4" />
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
                        onClick={handleCopyPartagerLink}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPartagerDialogOpen(false)}
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
