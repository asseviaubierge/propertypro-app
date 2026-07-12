"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatting";
import { showApiErrorToast } from "@/lib/toast-notifications";
import { getPublicPaymentConfig } from "@/lib/stripe-client";
import { RazorpayPayButton } from "@/components/payments/razorpay-pay-button";
import { PaystackPayButton } from "@/components/payments/paystack-pay-button";
import { PayPalPayButton } from "@/components/payments/paypal-pay-button";

const paymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.enum([
    "cash",
    "check",
    "bank_transfer",
    "credit_card",
    "debit_card",
    "online",
    "manual",
  ]),
  paidDate: z.string().min(1, "Payment date is required"),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

interface PaymentRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    amountPaid: number;
    balanceRemaining: number;
    tenantId?:
      | {
          firstName?: string | null;
          lastName?: string | null;
        }
      | null;
  } | null;
  onPaymentRecorded: () => void;
}

function toLocalDateTimeInput(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function PaymentRecordDialog({
  open,
  onOpenChange,
  invoice,
  onPaymentRecorded,
}: PaymentRecordDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [gateways, setGateways] = useState<{
    stripe: boolean;
    paypal: boolean;
    razorpay: boolean;
    paystack: boolean;
  }>({ stripe: false, paypal: false, razorpay: false, paystack: false });

  const hasTenantProfile = Boolean(invoice?.tenantId);
  const tenantDisplayName =
    [invoice?.tenantId?.firstName, invoice?.tenantId?.lastName]
      .map((name) => name?.trim())
      .filter(Boolean)
      .join(" ") || "Unknown tenant";

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: invoice?.balanceRemaining || 0,
      paymentMethod: "cash",
      paidDate: toLocalDateTimeInput(new Date()),
      transactionId: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (invoice && open) {
      form.reset({
        amount: invoice.balanceRemaining,
        paymentMethod: "cash",
        paidDate: toLocalDateTimeInput(new Date()),
        transactionId: "",
        notes: "",
      });
    }
  }, [invoice, open, form]);

  // Resolve which online gateways are usable so we only show their buttons.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    getPublicPaymentConfig().then((cfg) => {
      if (!active) return;
      setGateways({
        stripe: !!cfg?.gateways?.stripe?.configured,
        paypal: !!cfg?.gateways?.paypal?.configured,
        razorpay: !!cfg?.gateways?.razorpay?.configured,
        paystack: !!cfg?.gateways?.paystack?.configured,
      });
    });
    return () => {
      active = false;
    };
  }, [open]);

  const handlePayWithStripe = async () => {
    if (!invoice) return;
    if (!hasTenantProfile) {
      toast.error(
        "Stripe is unavailable — invoice is not linked to a tenant profile."
      );
      return;
    }

    const amount = form.getValues("amount") || invoice.balanceRemaining;
    if (amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (amount > invoice.balanceRemaining) {
      toast.error("Amount exceeds remaining balance.");
      return;
    }

    try {
      setStripeLoading(true);
      const response = await fetch(
        `/api/invoices/${invoice._id}/checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        }
      );
      const result = await response.json().catch(() => null);

      if (response.ok && result?.success && result.data?.url) {
        window.location.assign(result.data.url);
      } else {
        showApiErrorToast(result, "Failed to open Stripe checkout");
        setStripeLoading(false);
      }
    } catch (error) {
      console.error("Error starting Stripe checkout:", error);
      showApiErrorToast(error, "Failed to open Stripe checkout");
      setStripeLoading(false);
    }
  };

  // PayPal/Razorpay/Paystack settle in-page via popup; on success refresh + close.
  const handleGatewayPaid = () => {
    toast.success("Payment received");
    onPaymentRecorded();
    onOpenChange(false);
  };

  const onSubmit = async (data: PaymentForm) => {
    if (!invoice) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "add_payment",
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paidDate: new Date(data.paidDate).toISOString(),
          transactionId: data.transactionId,
          notes: data.notes,
        }),
      });

      const result = await response.json().catch(() => null);
      if (response.ok && result?.success) {
        toast.success("Payment recorded successfully");
        onPaymentRecorded();
        onOpenChange(false);
      } else {
        showApiErrorToast(result, "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      showApiErrorToast(error, "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;
  const tenantName =
    `${invoice.tenantId?.firstName ?? ""} ${invoice.tenantId?.lastName ?? ""}`.trim() ||
    "Unknown tenant";

  const stripeAmount = form.watch("amount") || invoice.balanceRemaining;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-160 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Record a payment for invoice {invoice.invoiceNumber} from{" "}
            {tenantName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 space-y-5">
          {/* Online checkout (only enabled gateways are shown) */}
          {(gateways.stripe ||
            gateways.paypal ||
            gateways.razorpay ||
            gateways.paystack) && (
            <div className="space-y-3">
              {gateways.stripe && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-muted/40 p-4">
                  <div>
                    <p className="text-sm font-medium">Collect via Stripe</p>
                    <p className="text-xs text-muted-foreground">
                      Opens Stripe Checkout for {formatCurrency(stripeAmount)} —
                      status updates automatically
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handlePayWithStripe}
                    disabled={stripeLoading || !hasTenantProfile}
                    className="bg-primary"
                  >
                    {stripeLoading ? "Opening…" : "Pay with Stripe"}
                  </Button>
                </div>
              )}

              {gateways.paypal && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-muted/40 p-4">
                  <div>
                    <p className="text-sm font-medium">Collect via PayPal</p>
                    <p className="text-xs text-muted-foreground">
                      Opens PayPal for {formatCurrency(stripeAmount)} — status
                      updates automatically
                    </p>
                  </div>
                  <PayPalPayButton
                    createUrl={`/api/invoices/${invoice._id}/paypal/create-order`}
                    captureUrl={`/api/invoices/${invoice._id}/paypal/capture-order`}
                    createBody={{ amount: stripeAmount }}
                    disabled={!hasTenantProfile}
                    className="sm:w-56"
                    onSuccess={handleGatewayPaid}
                  />
                </div>
              )}

              {gateways.razorpay && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-muted/40 p-4">
                  <div>
                    <p className="text-sm font-medium">Collect via Razorpay</p>
                    <p className="text-xs text-muted-foreground">
                      Opens Razorpay for {formatCurrency(stripeAmount)} — status
                      updates automatically
                    </p>
                  </div>
                  <RazorpayPayButton
                    createUrl={`/api/invoices/${invoice._id}/razorpay/create-order`}
                    verifyUrl={`/api/invoices/${invoice._id}/razorpay/verify`}
                    createBody={{ amount: stripeAmount }}
                    label="Pay with Razorpay"
                    description={`Invoice ${invoice.invoiceNumber}`}
                    disabled={!hasTenantProfile}
                    className="bg-[#0c2451] text-white hover:bg-[#0a1d40] sm:w-auto"
                    onSuccess={handleGatewayPaid}
                  />
                </div>
              )}

              {gateways.paystack && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-muted/40 p-4">
                  <div>
                    <p className="text-sm font-medium">Collect via Paystack</p>
                    <p className="text-xs text-muted-foreground">
                      Opens Paystack for {formatCurrency(stripeAmount)} — status
                      updates automatically
                    </p>
                  </div>
                  <PaystackPayButton
                    createUrl={`/api/invoices/${invoice._id}/paystack/initialize`}
                    verifyUrl={`/api/invoices/${invoice._id}/paystack/verify`}
                    createBody={{ amount: stripeAmount }}
                    label="Pay with Paystack"
                    disabled={!hasTenantProfile}
                    className="bg-[#0ba4db] text-white hover:bg-[#0a93c4] sm:w-auto"
                    onSuccess={handleGatewayPaid}
                  />
                </div>
              )}

              {!hasTenantProfile && (
                <p className="text-xs text-muted-foreground">
                  Online checkout is unavailable because this invoice is not
                  linked to an active tenant profile.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>
              {gateways.stripe ||
              gateways.paypal ||
              gateways.razorpay ||
              gateways.paystack
                ? "or record manually"
                : "record payment"}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Invoice total</p>
              <p className="mt-1 text-lg font-semibold">
                {formatCurrency(invoice.totalAmount)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Already paid</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">
                {formatCurrency(invoice.amountPaid)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Remaining
              </p>
              <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-400">
                {formatCurrency(invoice.balanceRemaining)}
              </p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              id="collect-payment-form"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={invoice.balanceRemaining}
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="credit_card">
                            Credit Card
                          </SelectItem>
                          <SelectItem value="debit_card">Debit Card</SelectItem>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paidDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collected at</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="Receipt / txn ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Collection notes"
                          className="min-h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="shrink-0 gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || stripeLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="collect-payment-form"
            disabled={submitting || stripeLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? "Saving…" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
