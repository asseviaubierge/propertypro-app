/**
 * PropertyPro - Payment Statistics Component
 * Display payment analytics and statistics
 */

"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
} from "lucide-react";
import { PaymentStatus, PaymentType, PaymentMethod } from "@/types";
import { formatCurrency } from "@/lib/utils/formatting";

interface PaymentData {
  _id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
}

interface PaymentStatisticsProps {
  payments: PaymentData[];
  className?: string;
}

export function PaymentStatistics({
  payments,
  className,
}: PaymentStatisticsProps) {
  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Calculate statistics
  const totalAmount = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const completedPayments = payments.filter(
    (p) => p.status === PaymentStatus.PAID
  );
  const completedAmount = completedPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const pendingPayments = payments.filter(
    (p) => p.status === PaymentStatus.PENDING
  );
  const pendingAmount = pendingPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const overduePayments = payments.filter((p) => {
    if (
      p.status === PaymentStatus.PAID ||
      p.status === PaymentStatus.REFUNDED
    ) {
      return false;
    }
    const now = new Date();
    const dueDate = new Date(p.dueDate);
    return dueDate < now;
  });
  const overdueAmount = overduePayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const failedPayments = payments.filter(
    (p) => p.status === PaymentStatus.FAILED
  );
  const failedAmount = failedPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  // Calculate collection rate
  const collectionRate =
    totalAmount > 0 ? (completedAmount / totalAmount) * 100 : 0;

  // Calculate average payment amount
  const averagePayment =
    payments.length > 0 ? totalAmount / payments.length : 0;

  // Payment type breakdown
  const paymentsByType = payments.reduce((acc, payment) => {
    acc[payment.type] = (acc[payment.type] || 0) + payment.amount;
    return acc;
  }, {} as Record<PaymentType, number>);

  // Payment method breakdown
  const paymentsByMethod = payments.reduce((acc, payment) => {
    if (payment.paymentMethod) {
      acc[payment.paymentMethod] =
        (acc[payment.paymentMethod] || 0) + payment.amount;
    }
    return acc;
  }, {} as Record<PaymentMethod, number>);

  // Monthly trend (last 6 months)
  const monthlyData = payments.reduce((acc, payment) => {
    const month = new Date(payment.createdAt).toISOString().slice(0, 7); // YYYY-MM
    acc[month] = (acc[month] || 0) + payment.amount;
    return acc;
  }, {} as Record<string, number>);

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1).toISOString().slice(0, 7);

  const currentMonthAmount = monthlyData[currentMonth] || 0;
  const lastMonthAmount = monthlyData[lastMonth] || 0;
  const monthlyGrowth =
    lastMonthAmount > 0
      ? ((currentMonthAmount - lastMonthAmount) / lastMonthAmount) * 100
      : 0;

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* Total Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {payments.length} total payments
          </p>
        </CardContent>
      </Card>

      {/* Collected Amount */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Collected</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(completedAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {completedPayments.length} completed •{" "}
            {formatPercentage(collectionRate)} rate
          </p>
        </CardContent>
      </Card>

      {/* Pending Amount */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(pendingAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {pendingPayments.length} pending payments
          </p>
        </CardContent>
      </Card>

      {/* Overdue Amount */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(overdueAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {overduePayments.length} overdue payments
          </p>
        </CardContent>
      </Card>

      {/* Average Payment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Payment</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(averagePayment)}
          </div>
          <p className="text-xs text-muted-foreground">
            Per payment transaction
          </p>
        </CardContent>
      </Card>

      {/* Monthly Growth */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
          {monthlyGrowth >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {monthlyGrowth >= 0 ? "+" : ""}
            {formatPercentage(monthlyGrowth)}
          </div>
          <p className="text-xs text-muted-foreground">
            vs last month ({formatCurrency(lastMonthAmount)})
          </p>
        </CardContent>
      </Card>

      {/* Failed Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(failedAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {failedPayments.length} failed payments
          </p>
        </CardContent>
      </Card>

      {/* Collection Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPercentage(collectionRate)}
          </div>
          <p className="text-xs text-muted-foreground">Success rate</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Payment Type Breakdown Component
export function PaymentTypeBreakdown({
  payments,
}: {
  payments: PaymentData[];
}) {
  const paymentsByType = payments.reduce((acc, payment) => {
    acc[payment.type] = (acc[payment.type] || 0) + payment.amount;
    return acc;
  }, {} as Record<PaymentType, number>);

  const totalAmount = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const getTypeLabel = (type: PaymentType) => {
    return type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Payment Type Breakdown
        </CardTitle>
        <CardDescription>Revenue distribution by payment type</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(paymentsByType).map(([type, amount]) => {
          const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
          return (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(type as PaymentType)}
                </Badge>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCurrency(amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Payment Method Breakdown Component
export function PaymentMethodBreakdown({
  payments,
}: {
  payments: PaymentData[];
}) {
  const paymentsByMethod = payments.reduce((acc, payment) => {
    if (payment.paymentMethod) {
      acc[payment.paymentMethod] =
        (acc[payment.paymentMethod] || 0) + payment.amount;
    }
    return acc;
  }, {} as Record<PaymentMethod, number>);

  const totalAmount = payments
    .filter((p) => p.paymentMethod)
    .reduce((sum, payment) => sum + payment.amount, 0);

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const getMethodLabel = (method: PaymentMethod) => {
    return method.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Method Breakdown
        </CardTitle>
        <CardDescription>
          Revenue distribution by payment method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(paymentsByMethod).map(([method, amount]) => {
          const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
          return (
            <div key={method} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getMethodLabel(method as PaymentMethod)}
                </Badge>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCurrency(amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
        {Object.keys(paymentsByMethod).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No payment method data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
