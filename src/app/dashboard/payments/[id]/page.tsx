"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  ArrowLeft,
  Edit,
  Trash2,
  MoreHorizontal,
  Calendar,
  DollarSign,
  User,
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { PaymentStatus, PaymentType, PaymentMethod } from "@/types";
import { shareDocumentViaWhatsApp } from "@/lib/whatsapp";

interface PaymentDetails {
  _id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paidDate?: string;
  description?: string;
  notes?: string;
  tenantId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  propertyId?: {
    _id: string;
    name: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    type?: string;
    ownerId?: string;
    managerId?: string;
  } | null;
  leaseId?: {
    _id: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function PaymentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { t, formatCurrency, formatDate } = useLocalizationContext();

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [isDeleting, setIsDeleting] = useState(false);
  // const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null
  );

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Fetch payment details
  useEffect(() => {
    const fetchPayment = async () => {
      if (!resolvedParams?.id) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/payments/${resolvedParams.id}`);

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            error.error || `Failed to fetch payment (${response.status})`
          );
        }

        const result = await response.json();

        if (result.success && result.data) {
          setPayment(result.data);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("payments.detail.toasts.loadError")
        );
        // Don't redirect immediately, let user try again
        setTimeout(() => {
          router.push("/dashboard/payments");
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };

    if (session && resolvedParams) {
      fetchPayment();
    }
  }, [session, resolvedParams, router, t]);

  // DISABLED: Delete functionality temporarily disabled
  // const handleDelete = async () => {
  //   if (!payment) return;

  //   try {
  //     setIsDeleting(true);
  //     const response = await fetch(`/api/payments/${payment._id}`, {
  //       method: "DELETE",
  //     });

  //     if (response.ok) {
  //       toast.success("Payment deleted successfully.");
  //       router.push("/dashboard/payments");
  //     } else {
  //       const error = await response.json();
  //       throw new Error(error.error || "Failed to delete payment");
  //     }
  //   } catch (error) {
  //     toast.error(
  //       error instanceof Error
  //         ? error.message
  //         : "Failed to delete payment. Please try again."
  //     );
  //   } finally {
  //     setIsDeleting(false);
  //     setShowDeleteDialog(false);
  //   }
  // };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return "default";
      case PaymentStatus.PAID:
        return "secondary";
      case PaymentStatus.OVERDUE:
        return "destructive";
      case PaymentStatus.FAILED:
        return "destructive";
      case PaymentStatus.REFUNDED:
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return Clock;
      case PaymentStatus.PAID:
        return CheckCircle;
      case PaymentStatus.OVERDUE:
        return XCircle;
      case PaymentStatus.FAILED:
        return XCircle;
      case PaymentStatus.REFUNDED:
        return RefreshCw;
      default:
        return Clock;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const paymentStatusLabel = (value: PaymentStatus) => {
    const labels: Record<string, string> = {
      paid: "Payé",
      pending: "En attente",
      overdue: "En retard",
      failed: "Échoué",
      refunded: "Remboursé",
    };
    return labels[String(value).toLowerCase()] || "Inconnu";
  };

  const paymentTypeLabel = (value: PaymentType) => {
    const labels: Record<string, string> = {
      rent: "Loyer",
      security_deposit: "Garantie",
      late_fee: "Pénalité de retard",
      utility: "Charges",
      maintenance: "Maintenance",
      other: "Autre",
    };
    return labels[String(value).toLowerCase()] || "Paiement";
  };

  const handleReceiptWhatsApp = async () => {
    if (!payment?.tenantId?.phone) {
      toast.error("Le numéro WhatsApp du locataire n’est pas renseigné.");
      return;
    }
    try {
      const tenantName = `${payment.tenantId.firstName || ""} ${payment.tenantId.lastName || ""}`.trim();
      const result = await shareDocumentViaWhatsApp({
        phone: payment.tenantId.phone,
        documentUrl: `/api/payments/${payment._id}/receipt`,
        fileName: `recu-${payment._id.slice(-8).toUpperCase()}.pdf`,
        title: `Reçu ${payment._id.slice(-8).toUpperCase()}`,
        message: `Bonjour ${tenantName}, voici votre reçu de paiement transmis depuis GESTION E-IMMO.`,
      });
      if (result === "unavailable") throw new Error("Numéro WhatsApp invalide");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossible de partager le reçu."
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            {t("payments.detail.notFound.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("payments.detail.notFound.description")}
          </p>
          <Link href="/dashboard/payments">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("payments.detail.notFound.backButton")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(payment.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2"></div>
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            {t("payments.detail.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.detail.header.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {payment.status === PaymentStatus.PENDING && (
            <Link href={`/dashboard/payments/${payment._id}/pay`}>
              <Button size="sm" variant="outline">
                <CreditCard className="h-4 w-4 mr-1" />
                {t("payments.detail.header.payNow")}
              </Button>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="h-4 w-4 mr-1" />
                {t("payments.detail.header.actions")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {t("payments.detail.header.actions")}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/payments/${payment._id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t("payments.detail.header.editPayment")}
                </Link>
              </DropdownMenuItem>
              {payment.status === PaymentStatus.PAID && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/payments/${payment._id}/receipt`}>
                      <FileText className="mr-1 h-4 w-4" />
                      {t("payments.detail.header.viewReceipt")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleReceiptWhatsApp}>
                    <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                    Envoyer le reçu par WhatsApp
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {/* <DropdownMenuItem
                className="text-red-600"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("payments.detail.header.deletePayment")}
              </DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/dashboard/payments">
            <Button size="sm" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("payments.detail.header.backToPayments")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Payment Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("payments.detail.overview.amount")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(payment.amount)}
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {paymentTypeLabel(payment.type)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("payments.detail.overview.status")}
            </CardTitle>
            <StatusIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={getStatusColor(payment.status) as any}
              className="text-sm"
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {paymentStatusLabel(payment.status)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {t("payments.detail.overview.due")}: {formatDate(payment.dueDate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("payments.detail.overview.paymentMethod")}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {payment.paymentMethod
                ? payment.paymentMethod
                    .replace("_", " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                : t("payments.detail.overview.notSpecified")}
            </div>
            {payment.paidDate && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("payments.detail.overview.paid")}:{" "}
                {formatDate(payment.paidDate)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tenant Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("payments.detail.tenant.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t("payments.detail.tenant.name")}
              </label>
              <p className="text-sm">
                {payment.tenantId?.firstName || t("payments.common.na")}{" "}
                {payment.tenantId?.lastName || ""}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t("payments.detail.tenant.email")}
              </label>
              <p className="text-sm">
                {payment.tenantId?.email || t("payments.common.na")}
              </p>
            </div>
            {payment.tenantId?.phone && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("payments.detail.tenant.phone")}
                </label>
                <p className="text-sm">{payment.tenantId.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property Information */}
        {payment.propertyId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t("payments.detail.property.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("payments.detail.property.propertyName")}
                </label>
                <p className="text-sm">
                  {payment.propertyId.name || t("payments.common.na")}
                </p>
              </div>
              {payment.propertyId.address && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("payments.detail.property.address")}
                  </label>
                  <p className="text-sm">
                    {payment.propertyId.address.street}
                    <br />
                    {payment.propertyId.address.city},{" "}
                    {payment.propertyId.address.state}{" "}
                    {payment.propertyId.address.zipCode}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("payments.detail.timeline.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t("payments.detail.timeline.created")}
              </label>
              <p className="text-sm">{formatDateTime(payment.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t("payments.detail.timeline.dueDate")}
              </label>
              <p className="text-sm">{formatDate(payment.dueDate)}</p>
            </div>
            {payment.paidDate && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("payments.detail.timeline.paidDate")}
                </label>
                <p className="text-sm">{formatDate(payment.paidDate)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t("payments.detail.timeline.lastUpdated")}
              </label>
              <p className="text-sm">{formatDateTime(payment.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("payments.detail.additional.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payment.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("payments.detail.additional.description")}
                </label>
                <p className="text-sm">{payment.description}</p>
              </div>
            )}
            {payment.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("payments.detail.additional.internalNotes")}
                </label>
                <p className="text-sm">{payment.notes}</p>
              </div>
            )}
            {payment.leaseId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("payments.detail.additional.associatedLease")}
                </label>
                <p className="text-sm">
                  {formatDate(payment.leaseId.startDate)} -{" "}
                  {formatDate(payment.leaseId.endDate)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DISABLED: Delete functionality temporarily disabled */}
      {/* <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer cette action ?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              payment record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> */}
    </div>
  );
}
