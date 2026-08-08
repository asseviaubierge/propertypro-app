"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loadScript } from "@/lib/payments/load-script";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayPayButtonProps {
  /** Endpoint that creates the Razorpay order (payment- or invoice-scoped). */
  createUrl: string;
  /** Endpoint that verifies the signature and settles the payment. */
  verifyUrl: string;
  /** Optional body for the create call (e.g. { amount } for invoices). */
  createBody?: Record<string, unknown>;
  label?: string;
  /** Name shown in the Razorpay modal header. */
  brandName?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * Opens Razorpay Checkout for a Payment or invoice: creates an order server-side,
 * opens the in-page modal, then posts the returned signature to the verify route.
 * Render only when Razorpay is configured (gate with
 * usePaymentGatewayStatus("razorpay")).
 */
export function RazorpayPayButton({
  createUrl,
  verifyUrl,
  createBody,
  label = "Pay with Razorpay",
  brandName = "Gestion E-Immo",
  description,
  className,
  disabled,
  onSuccess,
  onError,
}: RazorpayPayButtonProps) {
  const [loading, setLoading] = useState(false);

  const fail = (message: string) => {
    toast.error(message);
    onError?.(message);
    setLoading(false);
  };

  const handleClick = async () => {
    try {
      setLoading(true);
      await loadScript(RAZORPAY_SCRIPT);

      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody ?? {}),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.success || !result.data?.orderId) {
        fail(result?.error || "Failed to start Razorpay checkout");
        return;
      }

      const { orderId, keyId, amountMinor, currency } = result.data;
      const RazorpayCtor = (window as any).Razorpay;
      if (!RazorpayCtor) {
        fail("Razorpay could not be loaded. Please try again.");
        return;
      }

      const rzp = new RazorpayCtor({
        key: keyId,
        order_id: orderId,
        amount: amountMinor,
        currency,
        name: brandName,
        description,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch(verifyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verifyResult = await verifyRes.json().catch(() => null);
            if (verifyRes.ok && verifyResult?.success) {
              onSuccess?.();
            } else {
              fail(
                verifyResult?.error || "Payment could not be verified"
              );
            }
          } catch (error) {
            console.error("Razorpay verify failed:", error);
            fail("Payment could not be verified");
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.on("payment.failed", (response: { error?: { description?: string } }) => {
        fail(response?.error?.description || "Razorpay payment failed");
      });

      rzp.open();
    } catch (error) {
      console.error("Error starting Razorpay checkout:", error);
      fail("Failed to start Razorpay checkout");
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={
        className ?? "w-full bg-[#0c2451] text-white hover:bg-[#0a1d40]"
      }
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening Razorpay…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

export default RazorpayPayButton;
