"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Printer,
  Download,
  Mail,
  Pencil,
  Trash2,
  CreditCard,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { normalizeInvoiceForPrint } from "@/lib/invoice/invoice-shared";
import { UnifiedInvoiceDocument } from "@/components/invoices/UnifiedInvoiceDocument";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PaymentRecordDialog from "@/components/invoice/PaymentRecordDialog";
import { showSimpleError, showSimpleSuccess } from "@/lib/toast-notifications";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface FactureLineItem {
  description: string;
  amount: number;
  type: string;
  quantity?: number;
  unitPrice?: number;
  dueDate?: string;
}

interface Facture {
  _id: string;
  invoiceNumber: string;
  tenantId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  } | null;
  propertyId: {
    _id: string;
    name: string;
    ownerId?: any;
    address:
      | {
          street: string;
          city: string;
          state: string;
          zipCode: string;
          country: string;
        }
      | string;
  } | null;
  leaseId: {
    _id: string;
    startDate: string;
    endDate: string;
    status?: string;
    unitId?: string;
    terms: { rentAmount: number };
  } | null;
  issuer?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    accountType?: string;
    role?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    website?: string;
    businessLogo?: string;
    cip?: string;
    ifu?: string;
    rccm?: string;
  } | null;
  platform?: { name: string; displayName: string };
  unit?: {
    _id?: string;
    unitNumber?: string;
    unitType?: string;
    floor?: number;
  } | null;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxAmount?: number;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  lineItems: FactureLineItem[];
  notes?: string;
}

interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

function formatAddress(
  address:
    | {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country?: string;
      }
    | string
    | null
    | undefined,
): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function statusPillClasses(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50";
    case "partial":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50";
    case "overdue":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50";
    case "issued":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50";
    case "scheduled":
      return "bg-muted text-muted-foreground border-border";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border line-through";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function formatSafeDate(
  value: string | undefined,
  formatter: (d: Date) => string,
): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : formatter(parsed);
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatCurrency, formatDate } = useLocalizationContext();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    fetchFactureDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    const provider = searchParams.get("provider");
    const paypalToken = searchParams.get("token");
    if (!invoiceId || !paymentParam) return;

    const finishAndRefresh = () => {
      showSimpleSuccess(
        "Paiement reçu",
        "Votre paiement a été traité.",
      );
      fetchFactureDetails();
      router.replace(`/dashboard/accounting/invoices/${invoiceId}`);
    };

    if (paymentParam === "success" && provider === "paypal" && paypalToken) {
      (async () => {
        try {
          await fetch(`/api/invoices/${invoiceId}/paypal/capture-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: paypalToken }),
          });
        } catch (error) {
          console.error("PayPal capture failed:", error);
        } finally {
          finishAndRefresh();
        }
      })();
    } else if (paymentParam === "success" && sessionId) {
      (async () => {
        try {
          await fetch(`/api/invoices/${invoiceId}/checkout-session/reconcile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
        } catch (error) {
          console.error("Reconcile failed:", error);
        } finally {
          finishAndRefresh();
        }
      })();
    } else if (paymentParam === "canceled") {
      showSimpleError("Paiement annulé", "Le paiement a été annulé.");
      router.replace(`/dashboard/accounting/invoices/${invoiceId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, searchParams]);

  const fetchFactureDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${invoiceId}`);
      const data = await response.json();
      if (data?.success && data?.data) {
        setInvoice(data.data);
      } else {
        showSimpleError(
          "Erreur de chargement",
          data?.error || t("leases.invoices.details.toasts.fetchError"),
        );
        router.push("/dashboard/accounting/invoices");
      }
    } catch {
      showSimpleError(
        "Erreur de chargement",
        t("leases.invoices.details.toasts.fetchError"),
      );
      router.push("/dashboard/accounting/invoices");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!invoice) return;
    setActionLoading("print");
    try {
      const response = await fetch(`/api/invoices/${invoice._id}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Impossible de préparer la facture");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const previewWindow = window.open(url, "_blank");
      if (!previewWindow) {
        URL.revokeObjectURL(url);
        throw new Error("Impossible d’ouvrir l’aperçu");
      }

      previewWindow.onload = () => {
        previewWindow.print();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
    } catch {
      showSimpleError(
        "Échec de l'impression",
        "Impossible de préparer la facture pour l’impression.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;
    setActionLoading("download");
    try {
      const response = await fetch(`/api/invoices/${invoice._id}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Impossible de générer le PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `facture-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showSimpleSuccess("Téléchargement terminé", "La facture PDF a été téléchargée.");
    } catch {
      showSimpleError("Échec du téléchargement", "Impossible de télécharger la facture PDF.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmail = async () => {
    if (!invoice?.tenantId?.email) {
      showSimpleError("Aucun destinataire", "L'adresse e-mail du locataire n'est pas disponible.");
      return;
    }
    setActionLoading("email");
    try {
      const res = await fetch("/api/invoices/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice._id,
          tenantEmail: invoice.tenantId?.email,
          tenantName:
            `${invoice.tenantId?.firstName || ""} ${invoice.tenantId?.lastName || ""}`.trim(),
          invoiceNumber: invoice.invoiceNumber,
          subject: `Facture ${invoice.invoiceNumber}`,
          message: `Veuillez trouver ci-joint votre facture ${invoice.invoiceNumber}.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        showSimpleSuccess(
          "E-mail envoyé",
          t("leases.invoices.toasts.emailSuccess"),
        );
        fetchFactureDetails();
      } else {
        throw new Error(data?.error || "E-mail failed");
      }
    } catch {
      showSimpleError("Échec de l'envoi de l'e-mail", t("leases.invoices.toasts.emailError"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/invoices/${invoice._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        showSimpleSuccess("Facture supprimée", "");
        router.push("/dashboard/accounting/invoices");
      } else {
        throw new Error(data?.error || "Échec de la suppression");
      }
    } catch {
      showSimpleError("Échec de la suppression", "Impossible de supprimer la facture.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-120" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6">
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">
            {t("leases.invoices.details.notFound.title")}
          </h3>
          <p className="mb-4 text-muted-foreground">
            {t("leases.invoices.details.notFound.description")}
          </p>
          <Button onClick={() => router.push("/dashboard/accounting/invoices")}>
            {t("leases.invoices.details.notFound.backButton")}
          </Button>
        </div>
      </div>
    );
  }

  const tenantName = invoice.tenantId
    ? `${invoice.tenantId?.firstName || ""} ${
        invoice.tenantId?.lastName || ""
      }`.trim() || "—"
    : "—";
  const headerSubtitle =
    invoice.lineItems?.[0]?.description || invoice.propertyId?.name || "";
  const tenantPhone = invoice.tenantId?.phone || "";
  const tenantEmail = invoice.tenantId?.email || "";
  const statusLabel: Record<string, string> = {
    scheduled: "Planifiée",
    issued: "Émise",
    paid: "Payée",
    partial: "Partiellement payée",
    overdue: "En retard",
    cancelled: "Annulée",
    draft: "Brouillon",
  };
  const issuer = invoice.issuer;
  const issuerName = issuer
    ? `${issuer.firstName ?? ""} ${issuer.lastName ?? ""}`.trim() || issuer.businessName || ""
    : "";
  const issuerRoleRaw = (issuer?.role || issuer?.accountType || "").toLowerCase();
  const issuerRole =
    issuerRoleRaw === "manager" || issuerRoleRaw === "property_manager"
      ? "Gestionnaire"
      : issuerRoleRaw === "owner" || issuerRoleRaw === "direct_owner"
        ? "Propriétaire direct"
        : issuerRoleRaw === "agency"
          ? "Agence immobilière"
          : issuerRoleRaw === "admin" || issuerRoleRaw === "super_admin" || issuerRoleRaw === "e_immo"
            ? "Gestion E-IMMO"
            : issuerRoleRaw;

  const displayInvoice = normalizeInvoiceForPrint(invoice, {
    companyInfo: issuer
      ? {
          name: issuerName || "GESTION E-IMMO",
          legalName:
            issuer.businessName && issuer.businessName !== issuerName
              ? issuer.businessName
              : undefined,
          address: [issuer.address, issuer.city].filter(Boolean).join(", "),
          phone: issuer.phone || "",
          email: issuer.email || "",
          website: issuer.website || "",
          logo: issuer.businessLogo || "",
          accountType: issuer.accountType || issuer.role || "",
          roleLabel: issuerRole,
          cip: issuer.cip || "",
          ifu: issuer.ifu || "",
          rccm: issuer.rccm || "",
          platformName: "E-IMMO",
        } as any
      : undefined,
  });
  if (invoice.unit?.unitNumber) {
    (displayInvoice.property as any).unit = invoice.unit.unitNumber;
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {invoice.invoiceNumber}
            </h1>
            <Badge
              variant="outline"
              className={`capitalize ${statusPillClasses(invoice.status)}`}
            >
              {statusLabel[(invoice.status || "").toLowerCase()] || invoice.status || "Inconnu"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {tenantName}
            {headerSubtitle ? ` • ${headerSubtitle}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/accounting/invoices")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux factures
        </Button>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          disabled={actionLoading === "print"}
        >
          <Printer className="mr-2 h-4 w-4" />
          Imprimer
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={actionLoading === "download"}
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEmail}
          disabled={actionLoading === "email"}
        >
          <Mail className="mr-2 h-4 w-4" />
          E-mail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/dashboard/accounting/invoices/${invoice._id}/edit`)
          }
        >
          <Pencil className="mr-2 h-4 w-4" />
          Modifier
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera définitivement la facture {invoice.invoiceNumber}.
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          size="sm"
          className="ml-auto bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => setCollectOpen(true)}
          disabled={(invoice.balanceRemaining ?? 0) <= 0}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Enregistrer un paiement
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total de la facture</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(invoice.totalAmount ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Montant encaissé</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {formatCurrency(invoice.amountPaid ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Solde impayé
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400">
            {formatCurrency(invoice.balanceRemaining ?? 0)}
          </p>
        </div>
      </div>

      {/* Document de facture unifié : même contenu pour écran, impression et PDF */}
      <div className="bg-white px-2 py-6 sm:px-6">
        <UnifiedInvoiceDocument invoice={displayInvoice} />
      </div>

      <PaymentRecordDialog
        open={collectOpen}
        onOpenChange={setCollectOpen}
        invoice={{
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount ?? 0,
          amountPaid: invoice.amountPaid ?? 0,
          balanceRemaining: invoice.balanceRemaining ?? 0,
          tenantId: invoice.tenantId
            ? {
                firstName: invoice.tenantId?.firstName || "",
                lastName: invoice.tenantId?.lastName || "",
              }
            : null,
        }}
        onPaymentRecorded={() => {
          setCollectOpen(false);
          fetchFactureDetails();
        }}
      />
    </div>
  );
}
