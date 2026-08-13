"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { StripePayment } from "@/components/payments/stripe-payment";
import { PayPalPayButton } from "@/components/payments/paypal-pay-button";
import { RazorpayPayButton } from "@/components/payments/razorpay-pay-button";
import { PaystackPayButton } from "@/components/payments/paystack-pay-button";
import { usePaymentGatewayStatus } from "@/hooks/usePaymentGatewayStatus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CreditCard,
  Building2,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { PaymentStatus, PaymentType } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface PaymentDetails {
  _id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  dueDate: string;
  description?: string;
  tenantId: {
    _id: string;
    userId: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  propertyId: {
    _id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  createdAt: string;
}

export default function PaymentProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { t, formatCurrency, formatDate } = useLocalizationContext();

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null
  );

  const searchParams = useSearchParams();
  const stripeStatus = usePaymentGatewayStatus("stripe");
  const paypalStatus = usePaymentGatewayStatus("paypal");
  const razorpayStatus = usePaymentGatewayStatus("razorpay");
  const paystackStatus = usePaymentGatewayStatus("paystack");
  const [capturing, setCapturing] = useState(false);

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

        if (response.ok) {
          const result = await response.json();
          setPayment(result.data);
        } else {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch payment");
        }
      } catch (error) {
        console.error("Error fetching payment:", error);
        toast.error(t("payments.pay.toasts.loadFailed"));
        router.push("/dashboard/payments");
      } finally {
        setIsLoading(false);
      }
    };

    if (session && resolvedParams) {
      fetchPayment();
    }
  }, [session, resolvedParams, router, t]);

  // Capture a returning PayPal payment, then go to the success page.
  useEffect(() => {
    if (!resolvedParams?.id) return;
    const paymentParam = searchParams.get("payment");
    const provider = searchParams.get("provider");
    const token = searchParams.get("token");

    if (paymentParam === "success" && provider === "paypal" && token) {
      setCapturing(true);
      (async () => {
        try {
          await fetch(
            `/api/payments/${resolvedParams.id}/paypal/capture-order`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: token }),
            }
          );
        } catch (error) {
          console.error("PayPal capture failed:", error);
        } finally {
          toast.success(t("payments.pay.toasts.paymentSuccess"));
          router.push(`/dashboard/payments/${resolvedParams.id}?success=true`);
        }
      })();
    } else if (paymentParam === "canceled") {
      toast.error(
        t("payments.pay.toasts.paymentFailed", {
          values: { error: "canceled" },
        })
      );
      router.replace(`/dashboard/payments/${resolvedParams.id}/pay`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams, searchParams]);

  const handlePaymentSuccess = () => {
    toast.success(t("payments.pay.toasts.paymentSuccess"));
    // Redirect to payment details or success page
    router.push(`/dashboard/payments/${payment?._id}?success=true`);
  };

  const handlePaymentError = () => {
    // The active payment component (Stripe/PayPal/Razorpay/Paystack) already
    // shows the specific error toast — avoid a duplicate here.
  };

  const getDaysOverdue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (capturing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            Completing your PayPal payment…
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            {t("payments.pay.notFound.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("payments.pay.notFound.message")}
          </p>
          <Link href="/dashboard/payments">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("payments.pay.notFound.button")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if payment can be processed
  if (payment.status === PaymentStatus.PAID) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            {t("payments.pay.alreadyCompleted.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("payments.pay.alreadyCompleted.message")}
          </p>
          <Link href={`/dashboard/payments/${payment._id}`}>
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("payments.pay.alreadyCompleted.button")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const daysOverdue = getDaysOverdue(payment.dueDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/payments/${payment._id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("payments.pay.header.backButton")}
              </Button>
            </Link>
          </div>
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            {t("payments.pay.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.pay.header.subtitle")}
          </p>
        </div>
      </div>

      {/* Overdue Warning */}
      {daysOverdue > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">
                  {t("payments.pay.overdueWarning.title")}
                </p>
                <p className="text-sm">
                  {daysOverdue === 1
                    ? t("payments.pay.overdueWarning.message", {
                        values: { days: daysOverdue },
                      })
                    : t("payments.pay.overdueWarning.messagePlural", {
                        values: { days: daysOverdue },
                      })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t("payments.pay.summary.title")}
            </CardTitle>
            <CardDescription>
              {t("payments.pay.summary.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {t("payments.pay.summary.amount")}
              </span>
              <span className="text-2xl font-bold">
                {formatCurrency(payment.amount)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {t("payments.pay.summary.type")}
              </span>
              <Badge variant="outline" className="capitalize">
                {payment.type.replace("_", " ")}
              </Badge>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {t("payments.pay.summary.dueDate")}
              </span>
              <span>{formatDate(payment.dueDate)}</span>
            </div>

            {payment.description && (
              <div>
                <span className="text-muted-foreground">
                  {t("payments.pay.summary.description")}
                </span>
                <p className="text-sm mt-1">{payment.description}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{payment.propertyId.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {payment.propertyId.address.street}
                    <br />
                    {payment.propertyId.address.city},{" "}
                    {payment.propertyId.address.state}{" "}
                    {payment.propertyId.address.zipCode}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {payment.tenantId?.userId?.firstName || ""}{" "}
                  {payment.tenantId?.userId?.lastName || "Tenant"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {payment.tenantId?.userId?.email || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment methods (only configured gateways are shown) */}
        <div className="space-y-4">
          {stripeStatus.configured && (
            <StripePayment
              paymentId={payment._id}
              amount={payment.amount}
              description={`${payment.type.replace("_", " ")} payment for ${
                payment.propertyId.name
              }`}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          )}

          {stripeStatus.configured && paypalStatus.configured && (
            <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {paypalStatus.configured && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  PayPal
                </CardTitle>
                <CardDescription>
                  Pay securely with your PayPal account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PayPalPayButton
                  createUrl={`/api/payments/${payment._id}/paypal/create-order`}
                  captureUrl={`/api/payments/${payment._id}/paypal/capture-order`}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </CardContent>
            </Card>
          )}

          {razorpayStatus.configured && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Razorpay
                </CardTitle>
                <CardDescription>
                  Pay with cards, UPI, netbanking and wallets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RazorpayPayButton
                  createUrl={`/api/payments/${payment._id}/razorpay/create-order`}
                  verifyUrl={`/api/payments/${payment._id}/razorpay/verify`}
                  label={`Pay ${formatCurrency(payment.amount)} with Razorpay`}
                  description={`${payment.type.replace("_", " ")} payment`}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </CardContent>
            </Card>
          )}

          {paystackStatus.configured && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Paystack
                </CardTitle>
                <CardDescription>
                  Pay with cards, bank transfer and mobile money.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaystackPayButton
                  createUrl={`/api/payments/${payment._id}/paystack/initialize`}
                  verifyUrl={`/api/payments/${payment._id}/paystack/verify`}
                  label={`Pay ${formatCurrency(payment.amount)} with Paystack`}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </CardContent>
            </Card>
          )}

          {!stripeStatus.loading &&
            !paypalStatus.loading &&
            !razorpayStatus.loading &&
            !paystackStatus.loading &&
            !stripeStatus.configured &&
            !paypalStatus.configured &&
            !razorpayStatus.configured &&
            !paystackStatus.configured && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Online payments aren’t available right now. Please contact
                  your property manager to arrange payment.
                </AlertDescription>
              </Alert>
            )}
        </div>
      </div>
    </div>
  );
}
