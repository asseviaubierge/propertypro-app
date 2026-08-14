"use client";

import { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuthorization } from "@/hooks/useAuthorization";
import { usePaymentGatewayStatus } from "@/hooks/usePaymentGatewayStatus";

interface PaymentGatewayGateProps {
  /** Gateway to require. Defaults to the active default provider (Stripe). */
  provider?: string;
  children: ReactNode;
}

/**
 * Renders its children only when an online payment gateway is configured.
 * Otherwise shows a friendly message — actionable for admins (link to
 * settings), reassuring for tenants. Wrap any Stripe `<Elements>` collection
 * form so a freshly-installed app without keys doesn't show a broken card field.
 */
export function PaymentGatewayGate({
  provider = "stripe",
  children,
}: PaymentGatewayGateProps) {
  const { loading, configured } = usePaymentGatewayStatus(provider);
  const { isAdmin } = useAuthorization();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!configured) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Paiements en ligne indisponibles</AlertTitle>
        <AlertDescription>
          {isAdmin
            ? "Aucune passerelle de paiement n’est encore configurée. Ajoutez vos identifiants dans Paramètres → Paiements pour accepter les paiements en ligne."
            : "Online card payments aren’t available right now. Please contact your property manager to arrange payment."}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

export default PaymentGatewayGate;
