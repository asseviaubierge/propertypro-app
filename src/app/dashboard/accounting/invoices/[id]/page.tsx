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
import {
  downloadInvoiceAsPDF,
  generateInvoiceHTML,
  resolveInvoiceLogo,
  type PrintableInvoice,
} from "@/lib/invoice-print";
import { useState, useEffect, useCallback } from "react";
import { normalizeInvoiceForPrint } from "@/lib/invoice/invoice-shared";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PaymentRecordDialog from "@/components/invoice/PaymentRecordDialog";
import { showSimpleError, showSimpleSuccess } from "@/lib/toast-notifications";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface InvoiceLineItem {
  description: string;
  amount: number;
  type: string;
  quantity?: number;
  unitPrice?: number;
  dueDate?: string;
}

interface Invoice {
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
    terms: { rentAmount: number };
  } | null;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxAmount?: number;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  lineItems: InvoiceLineItem[];
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

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const preparePrintableInvoice =
    useCallback(async (): Promise<PrintableInvoice> => {
      if (!invoice) throw new Error("Invoice data not loaded");
      const { getCompanyInfo } = await import("@/lib/utils/company-info");
      const info = await getCompanyInfo();
      const normalized = normalizeInvoiceForPrint(invoice, {
        companyInfo: info || undefined,
      });
      return (await resolveInvoiceLogo(normalized)) as PrintableInvoice;
    }, [invoice]);

  useEffect(() => {
    if (!invoiceId) return;
    fetchInvoiceDetails();
    (async () => {
      const { getCompanyInfo } = await import("@/lib/utils/company-info");
      setCompanyInfo(await getCompanyInfo());
    })();
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
        "Payment received",
        "Your payment has been processed.",
      );
      fetchInvoiceDetails();
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
      showSimpleError("Payment canceled", "The checkout was canceled.");
      router.replace(`/dashboard/accounting/invoices/${invoiceId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, searchParams]);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${invoiceId}`);
      const data = await response.json();
      if (data?.success && data?.data) {
        setInvoice(data.data);
      } else {
        showSimpleError(
          "Load Error",
          data?.error || t("leases.invoices.details.toasts.fetchError"),
        );
        router.push("/dashboard/accounting/invoices");
      }
    } catch {
      showSimpleError(
        "Load Error",
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
      const printable = await preparePrintableInvoice();
      const previewWindow = window.open("", "_blank", "width=900,height=700");
      if (!previewWindow) throw new Error("Unable to open preview window");
      const htmlContent = generateInvoiceHTML(printable);
      previewWindow.document.open();
      previewWindow.document.write(`<!DOCTYPE html>
<html lang="${document.documentElement.lang || "en"}">
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${printable.invoiceNumber}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 24px; background-color: #f9fafb; }
    </style>
  </head>
  <body>${htmlContent}</body>
</html>`);
      previewWindow.document.close();
      previewWindow.focus();
      previewWindow.print();
    } catch (error) {
      console.error(error);
      showSimpleError(
        "Preview Failed",
        t("leases.invoices.details.toasts.previewError"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;
    setActionLoading("download");
    try {
      const printable = await preparePrintableInvoice();
      await downloadInvoiceAsPDF(printable);
      showSimpleSuccess(
        "Download Complete",
        t("leases.invoices.details.toasts.downloadSuccess"),
      );
    } catch (error) {
      console.error(error);
      showSimpleError(
        "Download Failed",
        t("leases.invoices.details.toasts.downloadError"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmail = async () => {
    if (!invoice?.tenantId?.email) {
      showSimpleError("No Recipient", "Tenant email is not available.");
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
          subject: `Invoice ${invoice.invoiceNumber}`,
          message: `Please find attached your invoice ${invoice.invoiceNumber}.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        showSimpleSuccess(
          "Email Sent",
          t("leases.invoices.toasts.emailSuccess"),
        );
        fetchInvoiceDetails();
      } else {
        throw new Error(data?.error || "Email failed");
      }
    } catch {
      showSimpleError("Email Failed", t("leases.invoices.toasts.emailError"));
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
        showSimpleSuccess("Invoice Deleted", "");
        router.push("/dashboard/accounting/invoices");
      } else {
        throw new Error(data?.error || "Delete failed");
      }
    } catch {
      showSimpleError("Delete Failed", "Could not delete invoice.");
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
              {invoice.status || "unknown"}
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
          Back to Invoices
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
          Print
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={actionLoading === "download"}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEmail}
          disabled={actionLoading === "email"}
        >
          <Mail className="mr-2 h-4 w-4" />
          Email
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/dashboard/accounting/invoices/${invoice._id}/edit`)
          }
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete invoice {invoice.invoiceNumber}.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleting ? "Deleting…" : "Delete"}
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
          Collect Payment
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Invoice Total</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(invoice.totalAmount ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {formatCurrency(invoice.amountPaid ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Outstanding
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400">
            {formatCurrency(invoice.balanceRemaining ?? 0)}
          </p>
        </div>
      </div>

      {/* Invoice document */}
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-semibold">Invoice</h2>
          {companyInfo?.logo ? (
            <div className="relative h-10 w-10 overflow-hidden rounded-md">
              <Image
                src={companyInfo.logo}
                alt={companyInfo.name}
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>
          ) : null}
        </div>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
          <dt className="font-medium">Invoice number</dt>
          <dd className="text-muted-foreground">{invoice.invoiceNumber}</dd>

          <dt className="font-medium">Date of issue</dt>
          <dd className="text-muted-foreground">
            {formatSafeDate(invoice.issueDate, formatDate)}
          </dd>

          <dt className="font-medium">Date due</dt>
          <dd className="text-muted-foreground">
            {formatSafeDate(invoice.dueDate, formatDate)}
          </dd>

          <dt className="font-medium">Status</dt>
          <dd>
            <Badge
              variant="outline"
              className={`capitalize ${statusPillClasses(invoice.status)}`}
            >
              {invoice.status || "unknown"}
            </Badge>
          </dd>
        </dl>

        <div className="mt-6 h-px bg-border" />

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bill From
            </p>
            <div className="mt-2 space-y-0.5 text-sm">
              <p className="font-semibold">{companyInfo?.name || "—"}</p>
              {companyInfo?.address ? (
                <p className="text-muted-foreground">{companyInfo.address}</p>
              ) : null}
              {companyInfo?.phone ? (
                <p className="text-muted-foreground">{companyInfo.phone}</p>
              ) : null}
              {companyInfo?.email ? (
                <p className="text-muted-foreground">{companyInfo.email}</p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bill To
            </p>
            <div className="mt-2 space-y-0.5 text-sm">
              <p className="font-semibold">{tenantName}</p>
              {tenantPhone ? (
                <p className="text-muted-foreground">{tenantPhone}</p>
              ) : null}
              {tenantEmail ? (
                <p className="text-muted-foreground">{tenantEmail}</p>
              ) : null}
              {invoice.propertyId ? (
                <p className="text-muted-foreground">
                  {invoice.propertyId?.name || "—"}
                  {invoice.propertyId?.address
                    ? ` — ${formatAddress(invoice.propertyId?.address)}`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold">Invoice details</h3>
          <div className="mt-3 overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">
                    Description
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Unit price
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems?.length ? (
                  invoice.lineItems.map((item, idx) => {
                    const qty = item.quantity ?? 1;
                    const unitPrice = item.unitPrice ?? item.amount;
                    return (
                      <tr
                        key={`${item?.description || "line-item"}-${idx}`}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">{item?.description || "—"}</td>
                        <td className="px-3 py-2 text-right">{qty}</td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatCurrency(item?.amount ?? 0)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No line items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatCurrency(invoice.subtotal ?? 0)}</dd>
              </div>
              {invoice.taxAmount ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd>{formatCurrency(invoice.taxAmount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatCurrency(invoice.totalAmount ?? 0)}</dd>
              </div>
            </dl>
          </div>
        </div>
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
          fetchInvoiceDetails();
        }}
      />
    </div>
  );
}
