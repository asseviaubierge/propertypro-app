"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loadScript } from "@/lib/payments/load-script";

const PAYSTACK_SCRIPT = "https://js.paystack.co/v2/inline.js";

interface PaystackPayButtonProps {
  /** Endpoint that initializes the Paystack transaction (payment- or invoice-scoped). */
  createUrl: string;
  /** Endpoint that verifies the transaction and settles the payment. */
  verifyUrl: string;
  /** Optional body for the initialize call (e.g. { amount } for invoices). */
  createBody?: Record<string, unknown>;
  label?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * Opens Paystack Inline for a Payment or invoice: initializes a transaction
 * server-side, opens the in-page popup, then posts the reference to the verify
 * route. Render only when Paystack is configured (gate with
 * usePaymentGatewayStatus("paystack")).
 */
export function PaystackPayButton({
  createUrl,
  verifyUrl,
  createBody,
  label = "Pay with Paystack",
  className,
  disabled,
  onSuccess,
  onError,
}: PaystackPayButtonProps) {
  const [loading, setLoading] = useState(false);

  const fail = (message: string) => {
    toast.error(message);
    onError?.(message);
    setLoading(false);
  };

  const verifyAndFinish = async (reference: string) => {
    try {
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const verifyResult = await verifyRes.json().catch(() => null);
      if (verifyRes.ok && verifyResult?.success) {
        onSuccess?.();
      } else {
        fail(verifyResult?.error || "Payment could not be verified");
      }
    } catch (error) {
      console.error("Paystack verify failed:", error);
      fail("Payment could not be verified");
    }
  };

  const handleClick = async () => {
    try {
      setLoading(true);
      await loadScript(PAYSTACK_SCRIPT);

      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody ?? {}),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.success || !result.data?.accessCode) {
        fail(result?.error || "Failed to start Paystack checkout");
        return;
      }

      const { accessCode, reference } = result.data;
      const PaystackPop = (window as any).PaystackPop;
      if (!PaystackPop) {
        fail("Paystack could not be loaded. Please try again.");
        return;
      }

      const popup = new PaystackPop();
      popup.resumeTransaction(accessCode, {
        onSuccess: () => verifyAndFinish(reference),
        onCancel: () => setLoading(false),
        onError: (error: { message?: string }) =>
          fail(error?.message || "Paystack payment failed"),
      });
    } catch (error) {
      console.error("Error starting Paystack checkout:", error);
      fail("Failed to start Paystack checkout");
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={
        className ?? "w-full bg-[#0ba4db] text-white hover:bg-[#0a93c4]"
      }
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening Paystack…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

export default PaystackPayButton;
