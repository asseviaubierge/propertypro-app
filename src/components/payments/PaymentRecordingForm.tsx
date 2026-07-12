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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/formatting";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  CreditCard,
  Calendar,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface PaymentData {
  tenantId: string;
  leaseId?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes: string;
  specificInvoiceId?: string;
}

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  status: string;
  daysOverdue: number;
}

interface PaymentAllocation {
  totalOutstanding: number;
  invoices: Invoice[];
}

interface PaymentPreview {
  paymentAmount: number;
  totalApplied: number;
  remainingAmount: number;
  applications: Array<{
    invoiceId: string;
    invoiceNumber: string;
    dueDate: string;
    currentBalance: number;
    amountToApply: number;
    newBalance: number;
    willBePaid: boolean;
  }>;
}

interface PaymentRecordingFormProps {
  tenantId: string;
  leaseId?: string;
  onPaymentRecorded?: (result: any) => void;
  onCancel?: () => void;
}

export default function PaymentRecordingForm({
  tenantId,
  leaseId,
  onPaymentRecorded,
  onCancel,
}: PaymentRecordingFormProps) {
  const { t, formatCurrency, formatDate } = useLocalizationContext();

  const [paymentData, setPaymentData] = useState<PaymentData>({
    tenantId,
    leaseId,
    amount: 0,
    paymentMethod: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
    specificInvoiceId: "",
  });

  const [allocation, setAllocation] = useState<PaymentAllocation | null>(null);
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch payment allocation on component mount
  useEffect(() => {
    fetchPaymentAllocation();
  }, [tenantId, leaseId]);

  // Update preview when amount changes
  useEffect(() => {
    if (paymentData.amount > 0) {
      fetchPaymentPreview();
    } else {
      setPreview(null);
    }
  }, [paymentData.amount, tenantId, leaseId]);

  const fetchPaymentAllocation = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ tenantId });
      if (leaseId) params.append("leaseId", leaseId);

      const response = await fetch(`/api/payments/record?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setAllocation(data.data.currentAllocation);
      } else {
        toast.error(t("payments.record.toasts.allocationLoadFailed"));
      }
    } catch (error) {
      console.error("Error fetching payment allocation:", error);
      toast.error(t("payments.record.toasts.allocationLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentPreview = async () => {
    try {
      const params = new URLSearchParams({
        tenantId,
        amount: paymentData.amount.toString(),
      });
      if (leaseId) params.append("leaseId", leaseId);

      const response = await fetch(`/api/payments/record?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setPreview(data.data.paymentPreview);
      }
    } catch (error) {
      console.error("Error fetching payment preview:", error);
    }
  };

  const handleInputChange = (field: keyof PaymentData, value: any) => {
    setPaymentData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push(t("payments.record.toasts.amountRequired"));
    }

    if (!paymentData.paymentMethod) {
      errors.push(t("payments.record.toasts.methodRequired"));
    }

    if (!paymentData.paymentDate) {
      errors.push(t("payments.record.toasts.dateRequired"));
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(
        t("payments.record.toasts.validationError", {
          errors: errors.join(", "),
        })
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/payments/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t("payments.record.toasts.recordSuccess"));

        // Show application details
        const { invoiceApplications, tenantBalance } = result.data;
        if (invoiceApplications.length > 0) {
          toast.success(
            t("payments.record.toasts.appliedWithBalance", {
              count: invoiceApplications.length,
              balance: formatCurrency(tenantBalance.totalOutstanding),
            })
          );
        }

        // Call callback if provided
        if (onPaymentRecorded) {
          onPaymentRecorded(result.data);
        }

        // Reset form
        setPaymentData({
          tenantId,
          leaseId,
          amount: 0,
          paymentMethod: "",
          paymentDate: new Date().toISOString().split("T")[0],
          notes: "",
          specificInvoiceId: "",
        });

        // Refresh allocation
        await fetchPaymentAllocation();
      } else {
        toast.error(result.message || t("payments.record.toasts.recordFailed"));
      }
    } catch {
      toast.error(t("payments.record.toasts.recordFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, daysOverdue: number) => {
    if (status === "overdue") {
      return (
        <Badge variant="destructive">
          {t("payments.record.invoices.overdueStatus", { days: daysOverdue })}
        </Badge>
      );
    } else if (status === "partial") {
      return (
        <Badge variant="secondary">
          {t("payments.record.invoices.partialStatus")}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          {t("payments.record.invoices.pendingStatus")}
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {t("payments.record.loading.message")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outstanding Invoices */}
      {allocation && allocation.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("payments.record.invoices.title")}
            </CardTitle>
            <CardDescription>
              {t("payments.record.invoices.totalOutstanding", {
                amount: formatCurrency(allocation.totalOutstanding),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allocation.invoices.map((invoice) => (
                <div
                  key={invoice.invoiceId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{invoice.invoiceNumber}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("payments.record.invoices.dueLabel")}{" "}
                      {formatDate(invoice.dueDate)}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-medium">
                      {formatCurrency(invoice.balanceRemaining)}
                    </div>
                    {getStatusBadge(invoice.status, invoice.daysOverdue)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("payments.record.form.title")}
          </CardTitle>
          <CardDescription>
            {t("payments.record.form.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  {t("payments.record.form.amountLabel")}
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) =>
                    handleInputChange("amount", parseFloat(e.target.value) || 0)
                  }
                  placeholder={t("payments.record.form.amountPlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">
                  {t("payments.record.form.methodLabel")}
                </Label>
                <Select
                  value={paymentData.paymentMethod}
                  onValueChange={(value) =>
                    handleInputChange("paymentMethod", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("payments.record.form.methodPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">
                      {t("payments.record.paymentMethods.bankTransfer")}
                    </SelectItem>
                    <SelectItem value="credit_card">
                      {t("payments.record.paymentMethods.creditCard")}
                    </SelectItem>
                    <SelectItem value="debit_card">
                      {t("payments.record.paymentMethods.debitCard")}
                    </SelectItem>
                    <SelectItem value="cash">
                      {t("payments.record.paymentMethods.cash")}
                    </SelectItem>
                    <SelectItem value="check">
                      {t("payments.record.paymentMethods.check")}
                    </SelectItem>
                    <SelectItem value="money_order">
                      {t("payments.record.paymentMethods.moneyOrder")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">
                {t("payments.record.form.dateLabel")}
              </Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) =>
                  handleInputChange("paymentDate", e.target.value)
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                {t("payments.record.form.notesLabel")}
              </Label>
              <Textarea
                id="notes"
                value={paymentData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder={t("payments.record.form.notesPlaceholder")}
                rows={3}
              />
            </div>

            {/* Payment Preview */}
            {preview && (
              <div className="space-y-4">
                <Separator />
                <div>
                  <h4 className="font-medium mb-3">
                    {t("payments.record.form.previewTitle")}
                  </h4>
                  <div className="space-y-2">
                    {preview.applications.map((app) => (
                      <div
                        key={app.invoiceId}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <span className="text-sm">{app.invoiceNumber}</span>
                        <div className="text-sm">
                          {formatCurrency(app.amountToApply)}
                          {app.willBePaid && (
                            <CheckCircle className="inline h-4 w-4 ml-1 text-green-600" />
                          )}
                        </div>
                      </div>
                    ))}

                    {preview.remainingAmount > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {t("payments.record.form.unappliedWarning", {
                            amount: formatCurrency(preview.remainingAmount),
                          })}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={submitting}
                >
                  {t("payments.record.form.cancelButton")}
                </Button>
              )}

              <Button
                type="submit"
                disabled={submitting || !paymentData.amount}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("payments.record.form.recordingButton")}
                  </>
                ) : (
                  t("payments.record.form.recordButton")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
