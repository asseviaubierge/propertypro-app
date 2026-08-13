"use client";

import { z } from "zod";
import React, { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getStripePromise } from "@/lib/stripe-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  CreditCard,
  Calendar,
  User,
  Building2,
  FileText,
  Banknote,
  Loader2,
  Lock,
} from "lucide-react";
import { PaymentType, PaymentMethod } from "@/types";
import { paymentCreateSchema } from "@/lib/validations";
import { FormDatePicker } from "@/components/ui/date-picker";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

// Initialize Stripe (publishable key resolved at runtime, DB-first)
const stripePromise = getStripePromise();

// Stripe appearance customization
const stripeAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#0570de",
    colorBackground: "#ffffff",
    colorText: "#30313d",
    colorDanger: "#df1b41",
    fontFamily: "system-ui, sans-serif",
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

// Note: Validation messages are now handled by the form component using translations
const paymentFormSchema = z.object({
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  leaseId: z.string().optional(),
  amount: z.number().min(0.01).max(100000),
  type: z.nativeEnum(PaymentType),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  dueDate: z.string().min(1),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

interface Unit {
  _id: string;
  unitNumber: string;
  type?: string;
  rentAmount?: number;
  status?: string;
}

interface PaymentFormProps {
  onSubmit: (data: PaymentFormData) => void;
  onStripePaymentSuccess?: (paymentIntentId: string, data: PaymentFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  initialData?: Partial<PaymentFormData>;
  tenants?: Array<{ id: string; name: string; email: string }>;
  properties?: Array<{ id: string; name: string; address: string; isMultiUnit?: boolean; units?: Unit[] }>;
  leases?: Array<{ id: string; propertyName: string; tenantName: string }>;
  enableStripePayment?: boolean;
}

// Inner form component that can use Stripe hooks
function PaymentFormInner({
  onSubmit,
  onStripePaymentSuccess,
  onCancel,
  isLoading = false,
  initialData,
  tenants = [],
  properties = [],
  leases = [],
  enableStripePayment = true,
  stripeClientSecret,
  onInitializeStripe,
  stripeInitializing,
  stripeError,
}: PaymentFormProps & {
  stripeClientSecret: string | null;
  onInitializeStripe: (amount: number) => Promise<string | null>;
  stripeInitializing: boolean;
  stripeError: string | null;
}) {
  const { t } = useLocalizationContext();
  const stripe = useStripe();
  const elements = useElements();

  const [selectedTenant, setSelectedTenant] = useState<string>(
    initialData?.tenantId || ""
  );
  const [selectedProperty, setSelectedProperty] = useState<string>(
    initialData?.propertyId || ""
  );
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [processingStripe, setProcessingStripe] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      tenantId: initialData?.tenantId || "",
      propertyId: initialData?.propertyId || "",
      unitId: initialData?.unitId || "",
      leaseId: initialData?.leaseId || "",
      amount: initialData?.amount || 0,
      type: initialData?.type || PaymentType.RENT,
      paymentMethod: initialData?.paymentMethod || undefined,
      dueDate: initialData?.dueDate || "",
      description: initialData?.description || "",
      notes: initialData?.notes || "",
    },
  });

  const watchedType = form.watch("type");
  const watchedPaymentMethod = form.watch("paymentMethod");
  const watchedAmount = form.watch("amount");
  const isStripePayment = enableStripePayment && (watchedPaymentMethod === PaymentMethod.CREDIT_CARD || watchedPaymentMethod === PaymentMethod.DEBIT_CARD);

  // Initialize Stripe when credit card is selected and amount is valid
  useEffect(() => {
    if (isStripePayment && watchedAmount > 0 && !stripeClientSecret && !stripeInitializing) {
      onInitializeStripe(watchedAmount);
    }
  }, [isStripePayment, watchedAmount, stripeClientSecret, stripeInitializing, onInitializeStripe]);

  const handleCardChange = (event: any) => {
    setCardComplete(event.complete);
    setCardError(event.error ? event.error.message : null);
  };

  const handleStripePayment = async () => {
    if (!stripe || !elements || !stripeClientSecret) {
      toast.error("Le système de paiement n’est pas prêt.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast.error("Informations de carte introuvables.");
      return;
    }

    setProcessingStripe(true);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(stripeClientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        toast.error(error.message || "Le paiement a échoué");
        setCardError(error.message || "Le paiement a échoué");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        toast.success("Paiement traité avec succès.");
        if (onStripePaymentSuccess) {
          onStripePaymentSuccess(paymentIntent.id, form.getValues());
        }
      } else {
        toast.error("Le paiement n’a pas abouti.");
      }
    } catch (err) {
      toast.error("Une erreur inattendue est survenue.");
    } finally {
      setProcessingStripe(false);
    }
  };

  const handleFormSubmit = async (data: PaymentFormData) => {
    if (isStripePayment) {
      await handleStripePayment();
    } else {
      onSubmit(data);
    }
  };

  // Get selected property details for unit selection
  const selectedPropertyData = properties.find(p => p.id === selectedProperty);
  const isMultiUnit = selectedPropertyData?.isMultiUnit && (selectedPropertyData?.units?.length ?? 0) > 0;
  const availableUnits = selectedPropertyData?.units || [];

  // Filter leases based on selected tenant and property
  const filteredLeases = leases.filter((lease) => {
    if (!selectedTenant && !selectedProperty) return true;
    // This would need to be implemented based on actual lease data structure
    return true;
  });

  const getPaymentTypeDescription = (type: PaymentType) => {
    switch (type) {
      case PaymentType.RENT:
        return t("payments.new.form.paymentTypeDescriptions.rent");
      case PaymentType.SECURITY_DEPOSIT:
        return t("payments.new.form.paymentTypeDescriptions.securityDeposit");
      case PaymentType.LATE_FEE:
        return t("payments.new.form.paymentTypeDescriptions.lateFee");
      case PaymentType.INVOICE:
        return t("payments.new.form.paymentTypeDescriptions.invoice");
      case PaymentType.PET_DEPOSIT:
        return t("payments.new.form.paymentTypeDescriptions.petDeposit");
      case PaymentType.UTILITY:
        return t("payments.new.form.paymentTypeDescriptions.utility");
      case PaymentType.MAINTENANCE:
        return t("payments.new.form.paymentTypeDescriptions.maintenance");
      case PaymentType.OTHER:
        return t("payments.new.form.paymentTypeDescriptions.other");
      default:
        return "";
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return t("payments.new.form.paymentMethods.creditCard");
      case PaymentMethod.DEBIT_CARD:
        return t("payments.new.form.paymentMethods.debitCard");
      case PaymentMethod.BANK_TRANSFER:
        return t("payments.new.form.paymentMethods.bankTransfer");
      case PaymentMethod.ACH:
        return t("payments.new.form.paymentMethods.ach");
      case PaymentMethod.CHECK:
        return t("payments.new.form.paymentMethods.check");
      case PaymentMethod.CASH:
        return t("payments.new.form.paymentMethods.cash");
      case PaymentMethod.MONEY_ORDER:
        return t("payments.new.form.paymentMethods.moneyOrder");
      case PaymentMethod.OTHER:
        return t("payments.new.form.paymentMethods.other");
      default:
        return method;
    }
  };

  const truncate = (text: string, max = 32) =>
    text && text.length > max ? text.slice(0, max) + "..." : text;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold leading-tight md:text-3xl">
          {initialData
            ? t("payments.new.form.headerTitleEdit")
            : t("payments.new.form.headerTitle")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {initialData
            ? t("payments.new.form.headerSubtitleEdit")
            : t("payments.new.form.headerSubtitle")}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("payments.new.form.paymentDetails.title")}
              </CardTitle>
              <CardDescription>
                {t("payments.new.form.paymentDetails.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("payments.new.form.paymentDetails.typeLabel")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "payments.new.form.paymentDetails.typePlaceholder"
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PaymentType.RENT}>
                            {t("payments.new.form.paymentTypes.rent")}
                          </SelectItem>
                          <SelectItem value={PaymentType.SECURITY_DEPOSIT}>
                            {t(
                              "payments.new.form.paymentTypes.securityDeposit"
                            )}
                          </SelectItem>
                          <SelectItem value={PaymentType.INVOICE}>
                            {t("payments.new.form.paymentTypes.invoice")}
                          </SelectItem>
                          <SelectItem value={PaymentType.LATE_FEE}>
                            {t("payments.new.form.paymentTypes.lateFee")}
                          </SelectItem>
                          <SelectItem value={PaymentType.PET_DEPOSIT}>
                            {t("payments.new.form.paymentTypes.petDeposit")}
                          </SelectItem>
                          <SelectItem value={PaymentType.UTILITY}>
                            {t("payments.new.form.paymentTypes.utility")}
                          </SelectItem>
                          <SelectItem value={PaymentType.MAINTENANCE}>
                            {t("payments.new.form.paymentTypes.maintenance")}
                          </SelectItem>
                          <SelectItem value={PaymentType.OTHER}>
                            {t("payments.new.form.paymentTypes.other")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {getPaymentTypeDescription(watchedType)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("payments.new.form.paymentDetails.amountLabel")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground md:text-xs">FCFA</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={t(
                              "payments.new.form.paymentDetails.amountPlaceholder"
                            )}
                            className="pl-12 md:pl-14"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("payments.new.form.paymentDetails.methodLabel")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "payments.new.form.paymentDetails.methodPlaceholder"
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PaymentMethod.CREDIT_CARD}>
                            {getPaymentMethodLabel(PaymentMethod.CREDIT_CARD)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.DEBIT_CARD}>
                            {getPaymentMethodLabel(PaymentMethod.DEBIT_CARD)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.BANK_TRANSFER}>
                            {getPaymentMethodLabel(PaymentMethod.BANK_TRANSFER)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.ACH}>
                            {getPaymentMethodLabel(PaymentMethod.ACH)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.CHECK}>
                            {getPaymentMethodLabel(PaymentMethod.CHECK)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.CASH}>
                            {getPaymentMethodLabel(PaymentMethod.CASH)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.MONEY_ORDER}>
                            {getPaymentMethodLabel(PaymentMethod.MONEY_ORDER)}
                          </SelectItem>
                          <SelectItem value={PaymentMethod.OTHER}>
                            {getPaymentMethodLabel(PaymentMethod.OTHER)}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t(
                          "payments.new.form.paymentDetails.methodDescription"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("payments.new.form.paymentDetails.dueDateLabel")}
                      </FormLabel>
                      <FormControl>
                        <FormDatePicker
                          value={
                            field.value
                              ? new Date(`${field.value}T00:00:00`)
                              : undefined
                          }
                          onChange={(date) => {
                            if (date) {
                              const localDate = new Date(
                                date.getFullYear(),
                                date.getMonth(),
                                date.getDate()
                              );
                              field.onChange(format(localDate, "yyyy-MM-dd"));
                            } else {
                              field.onChange("");
                            }
                          }}
                          placeholder={t(
                            "payments.new.form.paymentDetails.dueDatePlaceholder"
                          )}
                          disabled={(date) =>
                            date <
                            new Date(
                              new Date().setDate(new Date().getDate() - 1)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Stripe Card Input - Only shown when credit/debit card is selected */}
              {isStripePayment && (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Card Payment Details
                    </h4>

                    {stripeInitializing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Initializing secure payment...</span>
                      </div>
                    )}

                    {stripeError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{stripeError}</AlertDescription>
                      </Alert>
                    )}

                    {!stripeInitializing && (
                      <>
                        <div className="p-3 border rounded-md bg-white">
                          <CardElement
                            options={cardElementOptions}
                            onChange={handleCardChange}
                          />
                        </div>
                        {cardError && (
                          <p className="text-sm text-destructive mt-2">{cardError}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                          <Lock className="h-3 w-3" />
                          <span>Your payment information is secure and encrypted</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("payments.new.form.paymentDetails.descriptionLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "payments.new.form.paymentDetails.descriptionPlaceholder"
                        )}
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        "payments.new.form.paymentDetails.descriptionDescription"
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("payments.new.form.paymentDetails.notesLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "payments.new.form.paymentDetails.notesPlaceholder"
                        )}
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("payments.new.form.paymentDetails.notesDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Tenant and Property Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("payments.new.form.tenantProperty.title")}
              </CardTitle>
              <CardDescription>
                {t("payments.new.form.tenantProperty.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("payments.new.form.tenantProperty.tenantLabel")}
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedTenant(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "payments.new.form.tenantProperty.tenantPlaceholder"
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              <div>
                                <div className="font-medium">{tenant.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {tenant.email}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("payments.new.form.tenantProperty.propertyLabel")}
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedProperty(value);
                          // Clear unit selection when property changes
                          form.setValue("unitId", "");
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "payments.new.form.tenantProperty.propertyPlaceholder"
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              <div>
                                <div className="font-medium">
                                  {property.name}
                                  {property.isMultiUnit && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      ({property.units?.length || 0} units)
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {truncate(property.address || "")}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Unit Selection - Only shown for multi-unit properties */}
              {isMultiUnit && (
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Unité
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une unité" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableUnits.map((unit) => (
                            <SelectItem key={unit._id} value={unit._id}>
                              <div>
                                <div className="font-medium">
                                  Unité {unit.unitNumber}
                                  {unit.type && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      ({unit.type})
                                    </span>
                                  )}
                                </div>
                                {unit.rentAmount && (
                                  <div className="text-sm text-muted-foreground">
                                    {unit.rentAmount.toLocaleString("fr-FR")} FCFA/mois
                                  </div>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Sélectionnez l’unité concernée par ce paiement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="leaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("payments.new.form.tenantProperty.leaseLabel")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "payments.new.form.tenantProperty.leasePlaceholder"
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredLeases.map((lease) => (
                          <SelectItem key={lease.id} value={lease.id}>
                            <div>
                              <div className="font-medium">
                                {lease.propertyName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {lease.tenantName}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t("payments.new.form.tenantProperty.leaseDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={processingStripe}>
              {t("payments.new.form.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || processingStripe || (isStripePayment && (!cardComplete || !stripeClientSecret))}
            >
              {processingStripe ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : isLoading ? (
                t("payments.new.form.buttons.saving")
              ) : isStripePayment ? (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay Now
                </>
              ) : initialData ? (
                t("payments.new.form.buttons.update")
              ) : (
                t("payments.new.form.buttons.create")
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Main wrapper component that provides Stripe Elements context
export function PaymentForm({
  onSubmit,
  onStripePaymentSuccess,
  onCancel,
  isLoading = false,
  initialData,
  tenants = [],
  properties = [],
  leases = [],
  enableStripePayment = true,
}: PaymentFormProps) {
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeInitializing, setStripeInitializing] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const initializeStripePayment = useCallback(async (amount: number): Promise<string | null> => {
    if (amount <= 0) return null;

    try {
      setStripeInitializing(true);
      setStripeError(null);

      // Create a payment intent for the given amount
      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "usd",
          metadata: {
            type: "new_payment"
          }
        }),
      });

      const result = await response.json();

      if (response.ok && result.data?.clientSecret) {
        setStripeClientSecret(result.data.clientSecret);
        return result.data.clientSecret;
      } else {
        const message = result.error || "Failed to initialize payment";
        setStripeError(message);
        return null;
      }
    } catch (error) {
      console.error("Error initializing Stripe payment:", error);
      setStripeError("Failed to initialize payment session");
      return null;
    } finally {
      setStripeInitializing(false);
    }
  }, []);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: stripeAppearance,
        clientSecret: stripeClientSecret || undefined,
      }}
      key={stripeClientSecret || "no-secret"}
    >
      <PaymentFormInner
        onSubmit={onSubmit}
        onStripePaymentSuccess={onStripePaymentSuccess}
        onCancel={onCancel}
        isLoading={isLoading}
        initialData={initialData}
        tenants={tenants}
        properties={properties}
        leases={leases}
        enableStripePayment={enableStripePayment}
        stripeClientSecret={stripeClientSecret}
        onInitializeStripe={initializeStripePayment}
        stripeInitializing={stripeInitializing}
        stripeError={stripeError}
      />
    </Elements>
  );
}
