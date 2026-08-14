"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PaymentMethod } from "@/types";
import {
  CreditCard,
  Banknote,
  Building2,
  DollarSign,
  FileText,
  Wallet,
} from "lucide-react";

interface PaymentMethodSelectorProps {
  value?: PaymentMethod;
  onValueChange: (value: PaymentMethod) => void;
  placeholder?: string;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  value,
  onValueChange,
  placeholder = "Sélectionner un mode de paiement",
  label = "Mode de paiement",
  description,
  required = false,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        return CreditCard;
      case PaymentMethod.BANK_TRANSFER:
      case PaymentMethod.ACH:
        return Building2;
      case PaymentMethod.CHECK:
        return FileText;
      case PaymentMethod.CASH:
        return DollarSign;
      case PaymentMethod.MONEY_ORDER:
        return Wallet;
      default:
        return Banknote;
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return "Carte de crédit";
      case PaymentMethod.DEBIT_CARD:
        return "Carte de débit";
      case PaymentMethod.BANK_TRANSFER:
        return "Bank Transfer";
      case PaymentMethod.ACH:
        return "ACH Transfer";
      case PaymentMethod.CHECK:
        return "Chèque";
      case PaymentMethod.CASH:
        return "Espèces";
      case PaymentMethod.MONEY_ORDER:
        return "Money Order";
      case PaymentMethod.OTHER:
        return "Autre";
      default:
        return method;
    }
  };

  const getPaymentMethodDescription = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return "Payment via credit card";
      case PaymentMethod.DEBIT_CARD:
        return "Payment via debit card";
      case PaymentMethod.BANK_TRANSFER:
        return "Direct bank transfer";
      case PaymentMethod.ACH:
        return "Automated Clearing House transfer";
      case PaymentMethod.CHECK:
        return "Chèque physique ou électronique";
      case PaymentMethod.CASH:
        return "Cash payment";
      case PaymentMethod.MONEY_ORDER:
        return "Money order payment";
      case PaymentMethod.OTHER:
        return "Other payment method";
      default:
        return "";
    }
  };

  return (
    <FormItem>
      <FormLabel>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </FormLabel>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {Object.values(PaymentMethod).map((method) => {
            const Icon = getPaymentMethodIcon(method);
            return (
              <SelectItem key={method} value={method}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{getPaymentMethodLabel(method)}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}

// Standalone version without form context
export function SimplePaymentMethodSelector({
  value,
  onValueChange,
  placeholder = "Sélectionner un mode de paiement",
  disabled = false,
}: {
  value?: PaymentMethod;
  onValueChange: (value: PaymentMethod) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        return CreditCard;
      case PaymentMethod.BANK_TRANSFER:
      case PaymentMethod.ACH:
        return Building2;
      case PaymentMethod.CHECK:
        return FileText;
      case PaymentMethod.CASH:
        return DollarSign;
      case PaymentMethod.MONEY_ORDER:
        return Wallet;
      default:
        return Banknote;
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return "Carte de crédit";
      case PaymentMethod.DEBIT_CARD:
        return "Carte de débit";
      case PaymentMethod.BANK_TRANSFER:
        return "Bank Transfer";
      case PaymentMethod.ACH:
        return "ACH Transfer";
      case PaymentMethod.CHECK:
        return "Chèque";
      case PaymentMethod.CASH:
        return "Espèces";
      case PaymentMethod.MONEY_ORDER:
        return "Money Order";
      case PaymentMethod.OTHER:
        return "Autre";
      default:
        return method;
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.values(PaymentMethod).map((method) => {
          const Icon = getPaymentMethodIcon(method);
          return (
            <SelectItem key={method} value={method}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{getPaymentMethodLabel(method)}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
