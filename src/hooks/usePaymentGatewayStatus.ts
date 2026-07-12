"use client";

import { useEffect, useState } from "react";
import { getPublicPaymentConfig } from "@/lib/stripe-client";

export interface PaymentGatewayStatus {
  loading: boolean;
  /** True when the requested gateway has usable credentials (DB or env). */
  configured: boolean;
  /** The gateway selected to charge by default. */
  defaultProvider: string;
}

/**
 * Reports whether a payment gateway is configured and ready for collection,
 * using the cached public config (/api/payments/config). Lets payment forms
 * degrade gracefully when no gateway has been set up yet.
 */
export function usePaymentGatewayStatus(
  provider: string = "stripe"
): PaymentGatewayStatus {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState("stripe");

  useEffect(() => {
    let active = true;
    getPublicPaymentConfig()
      .then((cfg) => {
        if (!active) return;
        setConfigured(!!cfg?.gateways?.[provider]?.configured);
        setDefaultProvider(cfg?.defaultProvider || "stripe");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  return { loading, configured, defaultProvider };
}
