"use client";

import { useState, useEffect } from "react";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripePromise } from "@/lib/stripe-client";
import { PaymentGatewayGate } from "@/components/payments/PaymentGatewayGate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

// Initialize Stripe (publishable key resolved at runtime, DB-first)
const stripePromise = getStripePromise();

// Stripe Elements appearance customization
const appearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#0570de",
    colorBackground: "#ffffff",
    colorText: "#30313d",
    colorDanger: "#df1b41",
    fontFamily: "Inter, system-ui, sans-serif",
    spacingUnit: "4px",
    borderRadius: "6px",
  },
};

// Card Element options
const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#424770",
      "::placeholder": {
        color: "#aab7c4",
      },
      fontFamily: "Inter, system-ui, sans-serif",
    },
    invalid: {
      color: "#9e2146",
    },
  },
  hidePostalCode: false,
};

import { formatCurrency } from "@/lib/utils/formatting";

interface PaymentFormProps {
  paymentId: string;
  amount: number;
  description: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

// Inner payment form component that uses Stripe hooks
function PaymentFormInner({
  paymentId,
  amount,
  description,
  onSuccess,
  onError,
  clientSecret,
}: PaymentFormProps & { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "succeeded" | "failed"
  >("idle");
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleCardChange = (event: any) => {
    setCardComplete(event.complete);
    setCardError(event.error ? event.error.message : null);
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError("Payment system not ready");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card information not found");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPaymentStatus("processing");

    try {
      // Confirm the payment with Stripe
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              // You can add billing details here if needed
            },
          },
        });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (paymentIntent.status === "succeeded") {
        setPaymentStatus("succeeded");
        // Success toast is owned by the parent (via onSuccess); the component
        // shows the success card. Fall back to a toast if no handler is given.
        if (onSuccess) {
          onSuccess(paymentIntent.id);
        } else {
          toast.success("Payment successful!");
        }
      } else {
        throw new Error("Payment was not successful");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Payment failed";
      setError(errorMessage);
      setPaymentStatus("failed");
      onError?.(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  if (paymentStatus === "succeeded") {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-green-600">
                Payment Successful!
              </h3>
              <p className="text-muted-foreground">
                Your payment of {formatCurrency(amount)} has been processed
                successfully.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
        <CardDescription>
          {description} - {formatCurrency(amount)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Informations de la carte</label>
            <div className="p-3 border rounded-md bg-background">
              <CardElement
                options={cardElementOptions}
                onChange={handleCardChange}
              />
            </div>
            {cardError && (
              <p className="text-sm text-destructive">{cardError}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Vos informations de paiement sont sécurisées et chiffrées</span>
          </div>

          <Button
            type="submit"
            disabled={
              !stripe ||
              !cardComplete ||
              isLoading ||
              paymentStatus === "processing"
            }
            className="w-full"
          >
            {isLoading || paymentStatus === "processing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>Pay {formatCurrency(amount)}</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Outer payment form component that handles Elements provider
function PaymentForm({
  paymentId,
  amount,
  description,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setIsInitializing(true);
        const response = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentId }),
        });

        const result = await response.json();

        if (response.ok) {
          if (result.data?.alreadyCompleted) {
            toast.info(result.message ?? "Payment is already completed");
            onSuccess?.(result.data.paymentIntentId ?? "");
            return;
          }

          if (!result.data?.clientSecret) {
            throw new Error("Payment intent is not available");
          }

          setClientSecret(result.data.clientSecret);
          setInitError(null);
        } else {
          throw new Error(result.error || "Failed to create payment intent");
        }
      } catch (error) {
        console.error("Error creating payment intent:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to initialize payment";
        setInitError(errorMessage);
        // Surface init failures in a toast too (not just the inline alert).
        toast.error(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsInitializing(false);
      }
    };

    createPaymentIntent();
  }, [paymentId, onError]);

  if (isInitializing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Initialisation du paiement…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (initError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{initError}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Paiement non prêt</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const options = {
    clientSecret,
    appearance,
  };

  return (
    <PaymentGatewayGate>
      <Elements stripe={stripePromise} options={options}>
        <PaymentFormInner
          paymentId={paymentId}
          amount={amount}
          description={description}
          onSuccess={onSuccess}
          onError={onError}
          clientSecret={clientSecret}
        />
      </Elements>
    </PaymentGatewayGate>
  );
}

interface StripePaymentProps {
  paymentId: string;
  amount: number;
  description: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

export function StripePayment({
  paymentId,
  amount,
  description,
  onSuccess,
  onError,
}: StripePaymentProps) {
  return (
    <PaymentForm
      paymentId={paymentId}
      amount={amount}
      description={description}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

// Payment status checker component
interface PaymentStatusProps {
  paymentIntentId: string;
  onStatusChange?: (status: string) => void;
}

export function PaymentStatus({
  paymentIntentId,
  onStatusChange,
}: PaymentStatusProps) {
  const [status, setStatus] = useState<string>("checking");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/payments/status/${paymentIntentId}`);
        const result = await response.json();

        if (response.ok) {
          setStatus(result.data.status);
          onStatusChange?.(result.data.status);
        } else {
          throw new Error(result.error || "Failed to check payment status");
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        setStatus("error");
      } finally {
        setIsLoading(false);
      }
    };

    if (paymentIntentId) {
      checkPaymentStatus();
    }
  }, [paymentIntentId, onStatusChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Vérification de l’état du paiement…</span>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "succeeded":
        return "Payment successful";
      case "processing":
        return "Payment processing";
      case "failed":
        return "Payment failed";
      case "requires_payment_method":
        return "Payment method required";
      case "requires_confirmation":
        return "Payment confirmation required";
      default:
        return `Payment ${status}`;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusIcon()}
      <span className="text-sm">{getStatusText()}</span>
    </div>
  );
}
