"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  CreditCard,
  Banknote,
} from "lucide-react";
import { PaymentStatus, PaymentMethod, IPayment, ILease } from "@/types";
import { LeaseResponse } from "@/lib/services/lease.service";
import { toast } from "sonner";
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  showInfoToast,
  retryWithBackoff,
  PropertyProError,
  ErrorType,
} from "@/lib/error-handling";
import {
  usePaymentListUpdates,
  useRealTimePayments,
} from "@/hooks/useRealTimePayments";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface PaymentStatusDashboardProps {
  leaseId: string;
  lease: LeaseResponse;
  onPaymentUpdate?: (payment: IPayment) => void;
  onInvoiceGenerated?: (invoiceId: string) => void;
}

interface PaymentSummary {
  totalDue: number;
  totalPaid: number;
  totalOverdue: number;
  totalUpcoming: number;
  paymentProgress: number;
  nextPaymentDate: string | null;
  nextPaymentAmount: number;
}

export function PaymentStatusDashboard({
  leaseId,
  lease,
  onPaymentUpdate,
  onInvoiceGenerated,
}: PaymentStatusDashboardProps) {
  const { t, formatCurrency, formatDate, formatNumber } =
    useLocalizationContext();

  const [payments, setPayments] = useState<IPayment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({
    totalDue: 0,
    totalPaid: 0,
    totalOverdue: 0,
    totalUpcoming: 0,
    paymentProgress: 0,
    nextPaymentDate: null,
    nextPaymentAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time payment updates
  const { isConnected, connectionError, reconnect } = useRealTimePayments({
    leaseId,
    enabled: true,
  });

  // Auto-update payment list when real-time updates arrive
  usePaymentListUpdates(payments, setPayments, { leaseId });

  useEffect(() => {
    fetchPaymentData();
  }, [leaseId]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);

      const data = await retryWithBackoff(
        async () => {
          const response = await fetch(`/api/payments?leaseId=${leaseId}`);

          if (!response.ok) {
            const errorData = await response.json();
            throw new PropertyProError(
              ErrorType.NETWORK,
              errorData.message ||
                t("leases.details.payments.errors.fetchFailed"),
              {
                code: "PAYMENT_FETCH_FAILED",
                retryable: response.status >= 500,
              }
            );
          }

          return response.json();
        },
        3,
        1000
      );

      if (data?.success) {
        setPayments(data?.data ?? []);
        calculateSummary(data?.data ?? []);
      } else {
        throw new PropertyProError(
          ErrorType.DATABASE,
          data?.message || t("leases.details.payments.errors.invalidData"),
          { code: "INVALID_PAYMENT_DATA" }
        );
      }
    } catch (error) {
      console.error("Error fetching payment data:", error);
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (paymentData: IPayment[]) => {
    const now = new Date();

    let totalDue = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let totalUpcoming = 0;
    let nextPaymentDate: string | null = null;
    let nextPaymentAmount = 0;

    paymentData?.forEach((payment) => {
      const dueDate = new Date(payment?.dueDate ?? new Date());
      const isPastDue = dueDate < now;

      totalDue += payment?.amount ?? 0;
      totalPaid += payment?.amountPaid ?? 0;

      if (payment?.status === PaymentStatus.OVERDUE) {
        totalOverdue += (payment?.amount ?? 0) - (payment?.amountPaid ?? 0);
      } else if (payment?.status === PaymentStatus.PENDING && !isPastDue) {
        totalUpcoming += (payment?.amount ?? 0) - (payment?.amountPaid ?? 0);

        if (!nextPaymentDate || dueDate < new Date(nextPaymentDate)) {
          nextPaymentDate = payment?.dueDate
            ? new Date(payment.dueDate).toISOString()
            : null;
          nextPaymentAmount = payment?.amount || 0;
        }
      }
    });

    const paymentProgress = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    setSummary({
      totalDue,
      totalPaid,
      totalOverdue,
      totalUpcoming,
      paymentProgress,
      nextPaymentDate,
      nextPaymentAmount,
    });
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      showInfoToast(t("leases.details.payments.toasts.refreshing"));
      await fetchPaymentData();
      showSuccessToast(t("leases.details.payments.toasts.refreshSuccess"));
    } catch (error) {
      console.error("Error refreshing payment data:", error);
      showErrorToast(error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreatePayments = async () => {
    try {
      const response = await fetch(`/api/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: lease?.tenantId?._id || lease?.tenantId,
          propertyId: lease?.propertyId?._id || lease?.propertyId,
          leaseId: leaseId,
          amount: lease?.terms?.rentAmount ?? 0,
          type: "rent",
          dueDate: (() => {
            const now = new Date();
            const leaseStart = new Date(lease?.startDate ?? new Date());
            const leaseEnd = new Date(lease?.endDate ?? new Date());

            // If current date is within lease period, use it
            if (now >= leaseStart && now <= leaseEnd) {
              return now.toISOString();
            }

            // If current date is before lease start, use lease start date
            if (now < leaseStart) {
              return leaseStart.toISOString();
            }

            // If current date is after lease end, use a date 30 days before lease end
            const thirtyDaysBeforeEnd = new Date(leaseEnd);
            thirtyDaysBeforeEnd.setDate(thirtyDaysBeforeEnd.getDate() - 30);
            return thirtyDaysBeforeEnd.toISOString();
          })(),
          description: t("leases.details.payments.defaultDescription"),
        }),
      });

      const data = await response.json();

      if (data?.success) {
        toast.success(t("leases.details.payments.toasts.createSuccess"));
        fetchPaymentData();
      } else {
        toast.error(t("leases.details.payments.toasts.createError"));
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast.error(t("leases.details.payments.toasts.createError"));
    }
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return "text-green-600";
      case PaymentStatus.PENDING:
        return "text-yellow-600";
      case PaymentStatus.OVERDUE:
        return "text-red-600";
      case PaymentStatus.FAILED:
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return t("leases.details.payments.status.pending");
      case PaymentStatus.PAID:
        return t("leases.details.payments.status.paid");
      case PaymentStatus.FAILED:
        return t("leases.details.payments.status.failed");
      case PaymentStatus.REFUNDED:
        return t("leases.details.payments.status.refunded");
      case PaymentStatus.OVERDUE:
        return t("leases.details.payments.status.overdue");
      case PaymentStatus.PARTIAL:
        return t("leases.details.payments.status.partial");
      case PaymentStatus.CANCELLED:
        return t("leases.details.payments.status.cancelled");
      default:
        return status;
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    const key = `leases.invoices.details.lineItems.type.${type}`;
    const localizedType = t(key);
    return localizedType === key ? type.replace(/_/g, " ") : localizedType;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t("leases.details.payments.dashboardTitle")}
              </CardTitle>
              <CardDescription>
                {t("leases.details.payments.dashboardDescription", {
                  values: {
                    name:
                      lease?.propertyId?.name ||
                      t("leases.details.payments.thisLeaseFallback"),
                  },
                })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                {t("leases.details.payments.refreshButton")}
              </Button>
              <Button size="sm" onClick={handleCreatePayments}>
                <Plus className="h-4 w-4 mr-2" />
                {t("leases.details.payments.createPaymentButton")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("leases.details.payments.totalDueLabel")}
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary?.totalDue ?? 0)}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("leases.details.payments.totalPaidLabel")}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("leases.details.payments.overdueLabel")}
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalOverdue)}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("leases.details.payments.upcomingLabel")}
                </p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(summary.totalUpcoming)}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("leases.details.payments.paymentProgressTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("leases.details.payments.overallProgressLabel")}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatNumber(summary.paymentProgress, {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </div>
            <Progress value={summary.paymentProgress} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("leases.details.payments.paidLabel", {
                  values: { amount: formatCurrency(summary.totalPaid) },
                })}
              </span>
              <span className="text-muted-foreground">
                {t("leases.details.payments.totalLabel", {
                  values: { amount: formatCurrency(summary.totalDue) },
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Payment Alert */}
      {summary.nextPaymentDate && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            {t("leases.details.payments.nextPaymentLabel", {
              values: {
                amount: formatCurrency(summary.nextPaymentAmount),
                date: summary.nextPaymentDate
                  ? formatDate(summary.nextPaymentDate)
                  : "",
              },
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("leases.details.payments.recentPaymentsTitle")}
          </CardTitle>
          <CardDescription>
            {t("leases.details.payments.recentPaymentsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {t("leases.details.payments.noPaymentsMessage")}
              </p>
              <Button className="mt-4" onClick={handleCreatePayments}>
                {t("leases.details.payments.createFirstPaymentButton")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.slice(0, 5).map((payment) => (
                <div
                  key={payment._id.toString()}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      {payment.paymentMethod === PaymentMethod.CREDIT_CARD ? (
                        <CreditCard className="h-4 w-4" />
                      ) : (
                        <Banknote className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {getPaymentTypeLabel(payment.type)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("leases.details.payments.dueOnLabel", {
                          values: { date: formatDate(payment.dueDate) },
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(payment.amount)}
                    </p>
                    <Badge
                      variant={
                        payment.status === PaymentStatus.PAID
                          ? "default"
                          : "secondary"
                      }
                      className={getStatusColor(payment.status)}
                    >
                      {getStatusLabel(payment.status)}
                    </Badge>
                  </div>
                </div>
              ))}

              {payments.length > 5 && (
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm">
                    {t("leases.details.payments.viewAllButton")} (
                    {payments.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
