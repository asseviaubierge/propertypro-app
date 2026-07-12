"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loadScript } from "@/lib/payments/load-script";
import { getPublicPaymentConfig } from "@/lib/stripe-client";

interface PayPalPayButtonProps {
  /** Endpoint that creates the PayPal order (payment- or invoice-scoped). */
  createUrl: string;
  /** Endpoint that captures the approved order and settles the payment. */
  captureUrl: string;
  /** Optional body for the create call (e.g. { amount } for invoices). */
  createBody?: Record<string, unknown>;
  /** Order currency — must match the server (PayPal orders are USD here). */
  currency?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * True when a value is unmistakably another gateway's key (Stripe / Razorpay /
 * Paystack) rather than a PayPal REST Client ID. PayPal Client IDs never carry
 * the `_test_`/`_live_` token or the `pk_`/`sk_`/`rzp_` prefixes, so this catches
 * a credential pasted into the wrong field before we attempt a doomed SDK load.
 */
function looksLikeForeignGatewayKey(value: string): boolean {
  return /_(test|live)_/.test(value) || /^(pk_|sk_|rzp_|k_test|k_live)/.test(value);
}

/**
 * Renders the PayPal Smart Button for a Payment or invoice. Clicking it opens
 * PayPal's in-context popup (no full-page redirect, like Razorpay/Paystack):
 * the order is created server-side, approved in the popup, then captured via the
 * capture route. Render only when PayPal is configured
 * (gate with usePaymentGatewayStatus("paypal")).
 */
export function PayPalPayButton({
  createUrl,
  captureUrl,
  createBody,
  currency = "USD",
  className,
  disabled,
  onSuccess,
  onError,
}: PayPalPayButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  );
  const [processing, setProcessing] = useState(false);

  // The Buttons callbacks are registered once but must read the latest props
  // (e.g. an invoice amount edited after render), so we read them via refs.
  const createUrlRef = useRef(createUrl);
  const captureUrlRef = useRef(captureUrl);
  const createBodyRef = useRef(createBody);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  createUrlRef.current = createUrl;
  captureUrlRef.current = captureUrl;
  createBodyRef.current = createBody;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const fail = (message: string) => {
    toast.error(message);
    onErrorRef.current?.(message);
  };

  useEffect(() => {
    if (disabled) return;
    let active = true;
    // PayPal's SDK ships no types; the Buttons instance is treated as untyped.
    let buttons: any;

    (async () => {
      try {
        const cfg = await getPublicPaymentConfig();
        const clientId = cfg?.gateways?.paypal?.clientId as string | undefined;
        if (!clientId) {
          if (active) setStatus("unavailable");
          return;
        }
        // A wrong credential (e.g. a Stripe key pasted into PayPal's Client ID
        // field) makes the SDK return HTTP 400. Catch it here so we surface a
        // clear hint instead of a raw "failed to load script" error.
        if (looksLikeForeignGatewayKey(clientId)) {
          console.warn(
            "PayPal Client ID looks like another gateway's key — enter your " +
              "PayPal REST app Client ID in Admin → Settings → Payments " +
              "(use Test Connection to verify)."
          );
          if (active) setStatus("unavailable");
          return;
        }

        const sdkUrl =
          `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
            clientId
          )}&currency=${encodeURIComponent(currency)}` +
          `&intent=capture&components=buttons&disable-funding=paylater,credit`;
        await loadScript(sdkUrl);

        const paypal = (window as { paypal?: any }).paypal;
        if (!active) return;
        if (!paypal?.Buttons || !containerRef.current) {
          setStatus("unavailable");
          return;
        }

        buttons = paypal.Buttons({
          fundingSource: paypal.FUNDING.PAYPAL,
          style: { height: 44, label: "pay", tagline: false, color: "blue" },
          createOrder: async () => {
            const res = await fetch(createUrlRef.current, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(createBodyRef.current ?? {}),
            });
            const result = await res.json().catch(() => null);
            if (!res.ok || !result?.success || !result.data?.orderId) {
              const message =
                result?.error || "Failed to start PayPal checkout";
              fail(message);
              throw new Error(message);
            }
            return result.data.orderId as string;
          },
          onApprove: async (data: { orderID: string }) => {
            setProcessing(true);
            try {
              const res = await fetch(captureUrlRef.current, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: data.orderID }),
              });
              const result = await res.json().catch(() => null);
              if (res.ok && result?.success) {
                onSuccessRef.current?.();
              } else {
                fail(result?.error || "Payment could not be captured");
              }
            } catch (error) {
              console.error("PayPal capture failed:", error);
              fail("Payment could not be captured");
            } finally {
              if (active) setProcessing(false);
            }
          },
          onCancel: () => {
            if (active) setProcessing(false);
          },
          onError: (err: unknown) => {
            console.error("PayPal Buttons error:", err);
            fail("PayPal payment failed. Please try again.");
          },
        });

        if (buttons.isEligible && !buttons.isEligible()) {
          setStatus("unavailable");
          return;
        }

        await buttons.render(containerRef.current);
        if (active) setStatus("ready");
      } catch (error) {
        console.error("Error loading PayPal:", error);
        if (active) setStatus("unavailable");
      }
    })();

    return () => {
      active = false;
      try {
        buttons?.close?.();
      } catch {
        // ignore teardown errors
      }
    };
    // Render once per enable/currency change; live values are read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, currency]);

  if (disabled) {
    return (
      <Button
        type="button"
        disabled
        className={className ?? "w-full bg-[#0070ba] text-white"}
      >
        Pay with PayPal
      </Button>
    );
  }

  return (
    <div className={`relative min-h-11 ${className ?? ""}`}>
      <div ref={containerRef} className={status === "ready" ? "" : "invisible"} />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading PayPal…
        </div>
      )}

      {status === "unavailable" && (
        <p className="text-sm text-destructive">
          PayPal is unavailable right now. Please try another method.
        </p>
      )}

      {processing && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Completing payment…
        </div>
      )}
    </div>
  );
}

export default PayPalPayButton;
