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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  Banknote,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Edit,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  PaymentStatus,
  PaymentMethod,
  PaymentType,
  IPayment,
  ILease,
} from "@/types";
import { LeaseResponse } from "@/lib/services/lease.service";
import { toast } from "sonner";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface PaymentManagementSystemProps {
  leaseId: string;
  lease: LeaseResponse;
  onPaymentUpdate?: () => void;
}

interface PaymentFormData {
  amount: number;
  type: PaymentType;
  paymentMethod: PaymentMethod;
  dueDate: string;
  description: string;
  notes: string;
}

export function PaymentManagementSystem({
  leaseId,
  lease,
  onPaymentUpdate,
}: PaymentManagementSystemProps) {
  const { t, formatCurrency, formatDate } = useLocalizationContext();

  const getDefaultDescription = () => t("leases.details.payments.defaultDescription");
  const [payments, setPayments] = useState<IPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "ALL">(
    "ALL"
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<IPayment | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: lease.terms?.rentAmount || 0,
    type: PaymentType.RENT,
    paymentMethod: PaymentMethod.CREDIT_CARD,
    dueDate: new Date().toISOString().split("T")[0],
    description: getDefaultDescription(),
    notes: "",
  });
  const [processData, setProcessData] = useState({
    amount: 0,
    paymentMethod: PaymentMethod.CREDIT_CARD,
    transactionId: "",
    notes: "",
  });

  useEffect(() => {
    fetchPayments();
  }, [leaseId]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments?leaseId=${leaseId}`);
      const data = await response.json();

      if (data.success) {
        setPayments(data?.data || []);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error(t("leases.details.payments.errors.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: lease.tenantId._id || lease.tenantId,
          propertyId: lease.propertyId._id || lease.propertyId,
          leaseId: leaseId,
          amount: formData.amount,
          type: formData.type,
          dueDate: new Date(formData.dueDate).toISOString(),
          description: formData.description,
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(t("leases.details.payments.toasts.createSuccess"));
        setShowCreateDialog(false);
        fetchPayments();
        onPaymentUpdate?.();

        // Reset form
        setFormData({
          amount: lease.terms?.rentAmount || 0,
          type: PaymentType.RENT,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          dueDate: new Date().toISOString().split("T")[0],
          description: getDefaultDescription(),
          notes: "",
        });
      } else {
        toast.error(data.message || t("leases.details.payments.toasts.createError"));
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast.error(t("leases.details.payments.toasts.createError"));
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedPayment) return;

    try {
      const response = await fetch(
        `/api/tenant/payments/${selectedPayment._id}/pay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: processData.amount,
            paymentMethod: processData.paymentMethod,
            transactionId: processData.transactionId,
            notes: processData.notes,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success(t("leases.details.payments.toasts.processSuccess"));
        setShowProcessDialog(false);
        setSelectedPayment(null);
        fetchPayments();
        onPaymentUpdate?.();

        // Reset process data
        setProcessData({
          amount: 0,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          transactionId: "",
          notes: "",
        });
      } else {
        toast.error(data.message || t("leases.details.payments.toasts.processError"));
      }
    } catch {
      toast.error(t("leases.details.payments.toasts.processError"));
    }
  };

  const openProcessDialog = (payment: IPayment) => {
    setSelectedPayment(payment);
    setProcessData({
      amount: payment.amount - (payment.amountPaid || 0),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      transactionId: "",
      notes: "",
    });
    setShowProcessDialog(true);
  };

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return "bg-green-100 dark:bg-green-900/25 text-green-800 dark:text-green-200";
      case PaymentStatus.PENDING:
        return "bg-yellow-100 dark:bg-yellow-900/25 text-yellow-800 dark:text-yellow-200";
      case PaymentStatus.OVERDUE:
        return "bg-red-100 dark:bg-red-900/25 text-red-800 dark:text-red-200";
      case PaymentStatus.PARTIAL:
        return "bg-orange-100 dark:bg-orange-900/25 text-orange-800 dark:text-orange-200";
      case PaymentStatus.FAILED:
        return "bg-red-100 dark:bg-red-900/25 text-red-800 dark:text-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPaymentStatusLabel = (status: PaymentStatus) => {
    const key = `leases.details.payments.status.${status}`;
    const localizedStatus = t(key);
    return localizedStatus === key ? status : localizedStatus;
  };

  const getPaymentTypeLabel = (type: PaymentType) => {
    const key = `leases.invoices.details.lineItems.type.${type}`;
    const localizedType = t(key);
    return localizedType === key ? type.replace(/_/g, " ") : localizedType;
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    const key = `leases.details.payments.methods.${method}`;
    const localizedMethod = t(key);
    return localizedMethod === key ? method.replace(/_/g, " ") : localizedMethod;
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPaymentTypeLabel(payment.type).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
                {t("leases.details.payments.managementTitle")}
              </CardTitle>
              <CardDescription>
                {t("leases.details.payments.managementDescription")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchPayments}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("leases.details.payments.refreshButton")}
              </Button>
              <Dialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("leases.details.payments.createPaymentButton")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("leases.details.payments.createDialog.title")}</DialogTitle>
                    <DialogDescription>
                      {t("leases.details.payments.createDialog.description")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount">{t("leases.details.payments.fields.amount")}</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">{t("leases.details.payments.fields.paymentType")}</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value: PaymentType) =>
                            setFormData({ ...formData, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PaymentType.RENT}>
                              {getPaymentTypeLabel(PaymentType.RENT)}
                            </SelectItem>
                            <SelectItem value={PaymentType.SECURITY_DEPOSIT}>
                              {getPaymentTypeLabel(PaymentType.SECURITY_DEPOSIT)}
                            </SelectItem>
                            <SelectItem value={PaymentType.INVOICE}>
                              {getPaymentTypeLabel(PaymentType.INVOICE)}
                            </SelectItem>
                            <SelectItem value={PaymentType.PET_DEPOSIT}>
                              {getPaymentTypeLabel(PaymentType.PET_DEPOSIT)}
                            </SelectItem>
                            <SelectItem value={PaymentType.LATE_FEE}>
                              {getPaymentTypeLabel(PaymentType.LATE_FEE)}
                            </SelectItem>
                            <SelectItem value={PaymentType.MAINTENANCE}>
                              {getPaymentTypeLabel(PaymentType.MAINTENANCE)}
                            </SelectItem>
                            <SelectItem value={PaymentType.UTILITY}>
                              {getPaymentTypeLabel(PaymentType.UTILITY)}
                            </SelectItem>
                            <SelectItem value={PaymentType.OTHER}>
                              {getPaymentTypeLabel(PaymentType.OTHER)}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dueDate">{t("leases.details.payments.fields.dueDate")}</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) =>
                          setFormData({ ...formData, dueDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">{t("leases.details.payments.fields.description")}</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">{t("leases.details.payments.fields.notesOptional")}</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      {t("leases.details.payments.actions.cancel")}
                    </Button>
                    <Button onClick={handleCreatePayment}>
                      {t("leases.details.payments.createPaymentButton")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t("leases.details.payments.filters.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: PaymentStatus | "ALL") =>
                setStatusFilter(value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("leases.details.payments.filters.allStatus")}</SelectItem>
                <SelectItem value={PaymentStatus.PENDING}>{getPaymentStatusLabel(PaymentStatus.PENDING)}</SelectItem>
                <SelectItem value={PaymentStatus.PAID}>
                  {getPaymentStatusLabel(PaymentStatus.PAID)}
                </SelectItem>
                <SelectItem value={PaymentStatus.OVERDUE}>{getPaymentStatusLabel(PaymentStatus.OVERDUE)}</SelectItem>
                <SelectItem value={PaymentStatus.PENDING}>
                  {getPaymentStatusLabel(PaymentStatus.PENDING)}
                </SelectItem>
                <SelectItem value={PaymentStatus.PARTIAL}>{getPaymentStatusLabel(PaymentStatus.PARTIAL)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("leases.details.payments.listTitle", {
              values: { count: filteredPayments.length },
            })}
          </CardTitle>
          <CardDescription>{t("leases.details.payments.listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("leases.details.payments.noPaymentsMessage")}</p>
              <Button
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                {t("leases.details.payments.createFirstPaymentButton")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <div
                  key={payment._id.toString()}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      {payment.paymentMethod === PaymentMethod.CREDIT_CARD ? (
                        <CreditCard className="h-5 w-5" />
                      ) : (
                        <Banknote className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{getPaymentTypeLabel(payment.type)}</p>
                        <Badge className={getStatusColor(payment.status)}>
                          {getPaymentStatusLabel(payment.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payment.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t("leases.details.payments.dueOnLabel", {
                            values: { date: formatDate(payment.dueDate) },
                          })}
                        </span>
                        {payment.paidDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {t("leases.details.payments.paidOnLabel", {
                              values: { date: formatDate(payment.paidDate) },
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-lg">
                      {formatCurrency(payment.amount)}
                    </p>
                    {payment.amountPaid && payment.amountPaid > 0 && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {t("leases.details.payments.paidAmountLabel", {
                          values: { amount: formatCurrency(payment.amountPaid) },
                        })}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {payment.status !== PaymentStatus.PAID && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProcessDialog(payment)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          {t("leases.details.payments.actions.process")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Payment Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leases.details.payments.processDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("leases.details.payments.processDialog.description", {
                values: {
                  type: selectedPayment ? getPaymentTypeLabel(selectedPayment.type) : "",
                  amount: formatCurrency(selectedPayment?.amount || 0),
                },
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="processAmount">{t("leases.details.payments.fields.paymentAmount")}</Label>
                <Input
                  id="processAmount"
                  type="number"
                  step="0.01"
                  value={processData.amount}
                  onChange={(e) =>
                    setProcessData({
                      ...processData,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="processMethod">{t("leases.details.payments.fields.paymentMethod")}</Label>
                <Select
                  value={processData.paymentMethod}
                  onValueChange={(value: PaymentMethod) =>
                    setProcessData({ ...processData, paymentMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentMethod.CREDIT_CARD}>
                      {getPaymentMethodLabel(PaymentMethod.CREDIT_CARD)}
                    </SelectItem>
                    <SelectItem value={PaymentMethod.DEBIT_CARD}>
                      {getPaymentMethodLabel(PaymentMethod.DEBIT_CARD)}
                    </SelectItem>
                    <SelectItem value={PaymentMethod.BANK_TRANSFER}>
                      {getPaymentMethodLabel(PaymentMethod.BANK_TRANSFER)}
                    </SelectItem>
                    <SelectItem value={PaymentMethod.CASH}>{getPaymentMethodLabel(PaymentMethod.CASH)}</SelectItem>
                    <SelectItem value={PaymentMethod.CHECK}>{getPaymentMethodLabel(PaymentMethod.CHECK)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="transactionId">{t("leases.details.payments.fields.transactionIdOptional")}</Label>
              <Input
                id="transactionId"
                value={processData.transactionId}
                onChange={(e) =>
                  setProcessData({
                    ...processData,
                    transactionId: e.target.value,
                  })
                }
                placeholder={t("leases.details.payments.fields.transactionIdPlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="processNotes">{t("leases.details.payments.fields.notesOptional")}</Label>
              <Textarea
                id="processNotes"
                value={processData.notes}
                onChange={(e) =>
                  setProcessData({ ...processData, notes: e.target.value })
                }
                rows={3}
                placeholder={t("leases.details.payments.fields.notesPlaceholder")}
              />
            </div>
            {selectedPayment &&
              processData.amount <
                selectedPayment.amount - (selectedPayment.amountPaid || 0) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t("leases.details.payments.partialPaymentWarning", {
                      values: {
                        amount: formatCurrency(
                          selectedPayment.amount -
                            (selectedPayment.amountPaid || 0) -
                            processData.amount
                        ),
                      },
                    })}
                  </AlertDescription>
                </Alert>
              )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProcessDialog(false)}
            >
              {t("leases.details.payments.actions.cancel")}
            </Button>
            <Button onClick={handleProcessPayment}>
              {t("leases.details.payments.processDialog.title")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
