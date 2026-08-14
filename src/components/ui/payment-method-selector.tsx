import { useState } from "react";
import { PaymentMethod } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CreditCard,
  Banknote,
  Building2,
  FileText,
  DollarSign,
  Smartphone,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  selectedMethod?: PaymentMethod;
  onMethodSelect: (method: PaymentMethod) => void;
  availableMethods?: PaymentMethod[];
  disabled?: boolean;
  className?: string;
}

const paymentMethodConfig = {
  [PaymentMethod.CREDIT_CARD]: {
    label: "Carte de crédit",
    description: "Visa, Mastercard, American Express",
    icon: CreditCard,
    color: "bg-blue-50 border-blue-200 text-blue-700",
    selectedColor: "bg-blue-100 border-blue-300",
  },
  [PaymentMethod.DEBIT_CARD]: {
    label: "Carte de débit",
    description: "Prélèvement direct sur le compte bancaire",
    icon: CreditCard,
    color: "bg-green-50 border-green-200 text-green-700",
    selectedColor: "bg-green-100 border-green-300",
  },
  [PaymentMethod.BANK_TRANSFER]: {
    label: "Bank Transfer",
    description: "Virement bancaire direct",
    icon: Building2,
    color: "bg-purple-50 border-purple-200 text-purple-700",
    selectedColor: "bg-purple-100 border-purple-300",
  },
  [PaymentMethod.ACH]: {
    label: "ACH Transfer",
    description: "Prélèvement bancaire automatisé",
    icon: Building2,
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
    selectedColor: "bg-indigo-100 border-indigo-300",
  },
  [PaymentMethod.CHECK]: {
    label: "Chèque",
    description: "Chèque physique ou électronique",
    icon: FileText,
    color: "bg-gray-50 border-gray-200 text-gray-700",
    selectedColor: "bg-gray-100 border-gray-300",
  },
  [PaymentMethod.CASH]: {
    label: "Espèces",
    description: "Paiement en espèces",
    icon: Banknote,
    color: "bg-yellow-50 border-yellow-200 text-yellow-700",
    selectedColor: "bg-yellow-100 border-yellow-300",
  },
  [PaymentMethod.MONEY_ORDER]: {
    label: "Money Order",
    description: "Titre de paiement certifié",
    icon: FileText,
    color: "bg-orange-50 border-orange-200 text-orange-700",
    selectedColor: "bg-orange-100 border-orange-300",
  },
  [PaymentMethod.PAYPAL]: {
    label: "PayPal",
    description: "Payer avec un compte PayPal",
    icon: Smartphone,
    color: "bg-sky-50 border-sky-200 text-sky-700",
    selectedColor: "bg-sky-100 border-sky-300",
  },
  [PaymentMethod.RAZORPAY]: {
    label: "Razorpay",
    description: "Cartes, services bancaires et portefeuilles numériques",
    icon: Smartphone,
    color: "bg-blue-50 border-blue-200 text-blue-700",
    selectedColor: "bg-blue-100 border-blue-300",
  },
  [PaymentMethod.PAYSTACK]: {
    label: "Paystack",
    description: "Cartes, virement bancaire et argent mobile",
    icon: Smartphone,
    color: "bg-cyan-50 border-cyan-200 text-cyan-700",
    selectedColor: "bg-cyan-100 border-cyan-300",
  },
  [PaymentMethod.OTHER]: {
    label: "Autre",
    description: "Mode de paiement alternatif",
    icon: DollarSign,
    color: "bg-slate-50 border-slate-200 text-slate-700",
    selectedColor: "bg-slate-100 border-slate-300",
  },
};

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  availableMethods = Object.values(PaymentMethod),
  disabled = false,
  className,
}: PaymentMethodSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {availableMethods.map((method) => {
          const config = paymentMethodConfig[method];
          const Icon = config.icon;
          const isSelected = selectedMethod === method;

          return (
            <Card
              key={method}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected ? config.selectedColor : config.color,
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && onMethodSelect(method)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6" />
                    <div>
                      <h3 className="font-medium text-sm">{config.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 rounded-full">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function PaymentMethodBadge({
  method,
  className,
}: {
  method: PaymentMethod;
  className?: string;
}) {
  const config = paymentMethodConfig[method];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("flex items-center gap-1", className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function PaymentMethodIcon({
  method,
  className,
}: {
  method: PaymentMethod;
  className?: string;
}) {
  const config = paymentMethodConfig[method];
  const Icon = config.icon;

  return <Icon className={cn("h-4 w-4", className)} />;
}

interface CompactPaymentMethodSelectorProps {
  selectedMethod?: PaymentMethod;
  onMethodSelect: (method: PaymentMethod) => void;
  availableMethods?: PaymentMethod[];
  disabled?: boolean;
  className?: string;
}

export function CompactPaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  availableMethods = Object.values(PaymentMethod),
  disabled = false,
  className,
}: CompactPaymentMethodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full justify-between"
      >
        <div className="flex items-center gap-2">
          {selectedMethod ? (
            <>
              <PaymentMethodIcon method={selectedMethod} />
              {paymentMethodConfig[selectedMethod].label}
            </>
          ) : (
            "Sélectionner un mode de paiement"
          )}
        </div>
        <Smartphone className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-md shadow-lg">
          <div className="p-2 space-y-1">
            {availableMethods.map((method) => {
              const config = paymentMethodConfig[method];
              const Icon = config.icon;
              const isSelected = selectedMethod === method;

              return (
                <Button
                  key={method}
                  variant={isSelected ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    onMethodSelect(method);
                    setIsOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {config.label}
                  {isSelected && <Check className="h-4 w-4 ml-auto" />}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PaymentMethodList({
  methods,
  className,
}: {
  methods: PaymentMethod[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {methods.map((method) => (
        <PaymentMethodBadge key={method} method={method} />
      ))}
    </div>
  );
}
