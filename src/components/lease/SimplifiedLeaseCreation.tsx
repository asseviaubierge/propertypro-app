/**
 * PropertyPro - Simplified Lease Creation Form
 * Streamlined lease creation focusing on core fields only
 */

"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PropertyStatus } from "@/types";
import { FormDatePicker } from "@/components/ui/date-picker";
import { LeaseResponse, leaseService } from "@/lib/services/lease.service";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SimplifiedLeaseData {
  // Core Information
  propertyId: string;
  unitId: string;
  tenantId: string;

  // Dates
  startDate: string;
  endDate: string;

  // Financial Terms
  rentAmount: number;
  securityDeposit: number;
  rentDueDay: number;

  // Late Fee Configuration
  lateFeeAmount: number;
  lateFeeGracePeriodDays: number;
  lateFeeType: "fixed" | "percentage";

  // Auto-generation Settings
  autoGenerateInvoices: boolean;
  autoEmailInvoices: boolean;
  contractText: string;
}

interface Property {
  _id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  type?: string;
  ownerId?: { _id: string; firstName?: string; lastName?: string; businessName?: string; accountType?: string; email?: string; phone?: string };
  managerId?: { _id: string; firstName?: string; lastName?: string; businessName?: string; accountType?: string; email?: string; phone?: string };
  units: Array<{
    _id: string;
    unitNumber: string;
    unitType: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    rentAmount: number;
    securityDeposit: number;
    status: string;
  }>;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface SimplifiedLeaseCreationProps {
  mode?: "create" | "edit";
  leaseId?: string;
  initialLease?: LeaseResponse;
  onSuccess?: (leaseId?: string) => void;
}

const createInitialLeaseState = (): SimplifiedLeaseData => ({
  propertyId: "",
  unitId: "",
  tenantId: "",
  startDate: "",
  endDate: "",
  rentAmount: 0,
  securityDeposit: 0,
  rentDueDay: 1,
  lateFeeAmount: 50,
  lateFeeGracePeriodDays: 5,
  lateFeeType: "fixed",
  autoGenerateInvoices: true,
  autoEmailInvoices: false,
  contractText: "",
});

const LEASE_DATE_FROM_YEAR = 1900;

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

export default function SimplifiedLeaseCreation({
  mode = "create",
  leaseId,
  initialLease,
  onSuccess,
}: SimplifiedLeaseCreationProps) {
  const { t, formatCurrency } = useLocalizationContext();

  const [leaseData, setLeaseData] = useState<SimplifiedLeaseData>(
    createInitialLeaseState
  );
  const [originalLeaseData, setOriginalLeaseData] =
    useState<SimplifiedLeaseData>(createInitialLeaseState);

  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initializingLease, setInitializingLease] = useState(mode === "edit");
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEditMode = mode === "edit";
  const submitLabel = isEditMode
    ? t("leases.new.form.buttons.saveChanges")
    : t("leases.new.form.buttons.createLease");
  const submitLoadingLabel = isEditMode
    ? t("leases.new.form.buttons.savingChanges")
    : t("leases.new.form.buttons.creatingLease");
  const resetLabel = isEditMode
    ? t("leases.new.form.buttons.resetChanges")
    : t("leases.new.form.buttons.resetForm");

  // Fetch properties and tenants on component mount
  useEffect(() => {
    fetchProperties();
    fetchTenants();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoadingProperties(true);
      const response = await fetch("/api/properties?limit=100");
      const data = await response.json();

      if (response.ok && data.success) {
        // The API returns properties directly in data.data
        const properties = Array.isArray(data.data) ? data.data : [];

        // Ensure all properties have a units array (even if empty)
        const normalizedProperties = properties.map((property: any) => ({
          ...property,
          units: Array.isArray(property.units) ? property.units : [],
        }));

        setProperties(normalizedProperties);
      } else {
        toast.error(
          t("leases.new.form.toasts.loadPropertiesError"),
          data.error
            ? {
                description: data.error,
                duration: 5000,
              }
            : undefined
        );
        setProperties([]);
      }
    } catch (error) {
      toast.error(t("leases.new.form.toasts.loadPropertiesError"));
      setProperties([]);
    } finally {
      setLoadingProperties(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/tenants?limit=100");
const data = await response.json();

if (response.ok && data.success) {
  setTenants(Array.isArray(data.data) ? data.data : []);
} else {
        toast.error(
          t("leases.new.form.toasts.loadTenantsError"),
          data.error
            ? {
                description: data.error,
                duration: 5000,
              }
            : undefined
        );
      }
    } catch (error) {
      toast.error(t("leases.new.form.toasts.loadTenantsError"));
    }
  };

  const mapLeaseToFormData = (lease: LeaseResponse): SimplifiedLeaseData => {
    const propertyId =
      typeof lease.propertyId === "string"
        ? lease.propertyId
        : lease.propertyId?._id || "";
    const tenantId =
      typeof lease.tenantId === "string"
        ? lease.tenantId
        : lease.tenantId?._id || "";
    const unitId =
      typeof lease.unitId === "string" ? lease.unitId : lease.unit?._id || "";

    const paymentConfig = (lease.terms as any)?.paymentConfig;
    const lateFeeConfig = paymentConfig?.lateFeeConfig;

    return {
      propertyId: propertyId || "",
      unitId: unitId || "",
      tenantId: tenantId || "",
      startDate: lease.startDate ? lease.startDate.slice(0, 10) : "",
      endDate: lease.endDate ? lease.endDate.slice(0, 10) : "",
      rentAmount: lease.terms?.rentAmount ?? 0,
      securityDeposit: lease.terms?.securityDeposit ?? 0,
      rentDueDay: paymentConfig?.rentDueDay ?? 1,
      lateFeeAmount: lateFeeConfig?.feeAmount ?? lease.terms?.lateFee ?? 0,
      lateFeeGracePeriodDays: lateFeeConfig?.gracePeriodDays ?? 0,
      lateFeeType:
        lateFeeConfig?.feeType === "percentage" ? "percentage" : "fixed",
      autoGenerateInvoices: paymentConfig?.autoGenerateInvoices ?? true,
      autoEmailInvoices: paymentConfig?.autoEmailInvoices ?? false,
      contractText: (lease as any).contractText ?? "",
    };
  };

  const hydrateLeaseData = (lease: LeaseResponse) => {
    const mapped = mapLeaseToFormData(lease);
    setLeaseData(mapped);
    setOriginalLeaseData({ ...mapped });
  };

  const loadLeaseDetails = async (id: string) => {
    try {
      setInitializingLease(true);
      const lease = await leaseService.getLeaseById(id);
      hydrateLeaseData(lease);
      setLeaseError(null);
    } catch (error) {
      console.error("Failed to load lease", error);
      const fallbackMessage = t("leases.new.form.errors.loadLeaseGeneric");
      const message = error instanceof Error ? error.message : fallbackMessage;
      setLeaseError(message);
      toast.error(t("leases.new.form.toasts.loadLeaseError"), {
        description: message !== fallbackMessage ? message : undefined,
        duration: 5000,
      });
    } finally {
      setInitializingLease(false);
    }
  };

  useEffect(() => {
    if (mode !== "edit") {
      setOriginalLeaseData(createInitialLeaseState());
      return;
    }

    if (initialLease) {
      hydrateLeaseData(initialLease);
      setInitializingLease(false);
      setLeaseError(null);
      return;
    }

    if (leaseId) {
      void loadLeaseDetails(leaseId);
    } else {
      setInitializingLease(false);
    }
  }, [mode, leaseId, initialLease]);

  const handleInputChange = (field: keyof SimplifiedLeaseData, value: any) => {
    setLeaseData((prev) => ({
      ...prev,
      [field]: value,
    }));
    validateField(field, value);
  };

  const setError = (
    field: keyof SimplifiedLeaseData,
    message: string | null
  ) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  const getFieldErrorMessage = (
    field: keyof SimplifiedLeaseData,
    value: any
  ): string | null => {
    let message: string | null = null;
    if (field === "propertyId" && !value)
      message = t("leases.new.form.validation.propertyRequired");
    if (field === "unitId" && !value)
      message = t("leases.new.form.validation.unitRequired");
    if (field === "tenantId" && !value)
      message = t("leases.new.form.validation.tenantRequired");
    if (field === "startDate" && !value)
      message = t("leases.new.form.validation.startDateRequired");
    if (field === "endDate" && !value)
      message = t("leases.new.form.validation.endDateRequired");
    if (field === "rentAmount" && (typeof value !== "number" || value <= 0))
      message = t("leases.new.form.validation.rentPositive");
    if (field === "securityDeposit" && (typeof value !== "number" || value < 0))
      message = t("leases.new.form.validation.securityDepositNonNegative");
    if (field === "lateFeeAmount" && (typeof value !== "number" || value < 0))
      message = t("leases.new.form.validation.lateFeeNonNegative");
    if (
      field === "lateFeeGracePeriodDays" &&
      (typeof value !== "number" || value < 0)
    )
      message = t("leases.new.form.validation.gracePeriodNonNegative");

    if (field === "endDate" && value && leaseData.startDate) {
      const start = new Date(leaseData.startDate);
      const end = new Date(value);
      if (end <= start)
        message = t("leases.new.form.validation.endDateAfterStart");
    }

    return message;
  };

  const validateField = (
    field: keyof SimplifiedLeaseData,
    value: any
  ): boolean => {
    const message = getFieldErrorMessage(field, value);
    setError(field, message);
    return !message;
  };

  const validateAll = (): {
    ok: boolean;
    messages: string[];
    invalidFields: Array<keyof SimplifiedLeaseData>;
  } => {
    const checks: Array<[keyof SimplifiedLeaseData, any]> = [
      ["propertyId", leaseData.propertyId],
      ["unitId", leaseData.unitId],
      ["tenantId", leaseData.tenantId],
      ["startDate", leaseData.startDate],
      ["endDate", leaseData.endDate],
      ["rentAmount", leaseData.rentAmount],
      ["securityDeposit", leaseData.securityDeposit],
      ["lateFeeAmount", leaseData.lateFeeAmount],
      ["lateFeeGracePeriodDays", leaseData.lateFeeGracePeriodDays],
    ];
    const messages: string[] = [];
    const invalidFields: Array<keyof SimplifiedLeaseData> = [];
    checks.forEach(([f, v]) => {
      const message = getFieldErrorMessage(f, v);
      setError(f, message);
      if (message) {
        invalidFields.push(f);
        messages.push(message);
      }
    });
    return { ok: messages.length === 0, messages, invalidFields };
  };

  const focusField = (field: keyof SimplifiedLeaseData) => {
    const idMap: Record<keyof SimplifiedLeaseData, string> = {
      propertyId: "propertySelect",
      unitId: "unitSelect",
      tenantId: "tenantSelect",
      startDate: "startDatePicker",
      endDate: "endDatePicker",
      rentAmount: "rentAmount",
      securityDeposit: "securityDeposit",
      rentDueDay: "rentDueDaySelect",
      lateFeeAmount: "lateFeeAmount",
      lateFeeGracePeriodDays: "lateFeeGracePeriodDays",
      lateFeeType: "lateFeeTypeSelect",
      autoGenerateInvoices: "autoGenerateInvoices",
      autoEmailInvoices: "autoEmailInvoices",
      contractText: "contractText",
    };
    const id = idMap[field];
    if (!id) return;
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  const focusFirstInvalid = (
    invalidFields: Array<keyof SimplifiedLeaseData>
  ) => {
    if (invalidFields.length > 0) {
      focusField(invalidFields[0]);
    }
  };

  const getSelectedProperty = () => {
    return properties.find((p) => p._id === leaseData.propertyId);
  };

  const getAvailableUnits = () => {
    const property = getSelectedProperty();

    if (!property || !Array.isArray(property.units)) {
      return [];
    }

    const selectedUnitId = leaseData.unitId;

    const availableUnits = property.units.filter((unit) => {
      if (!unit || typeof unit !== "object") {
        return false;
      }

      if (!unit.unitNumber) {
        return false;
      }

      if (mode === "edit" && unit._id === selectedUnitId) {
        return true;
      }

      const status =
        typeof unit.status === "string" ? unit.status.toLowerCase() : "";
      return status === PropertyStatus.AVAILABLE;
    });

    if (
      mode === "edit" &&
      selectedUnitId &&
      !availableUnits.some((unit) => unit._id === selectedUnitId)
    ) {
      const selectedUnit = property.units.find(
        (unit) => unit?._id === selectedUnitId
      );
      if (selectedUnit) {
        return [selectedUnit, ...availableUnits];
      }
    }

    return availableUnits;
  };

  const getSelectedUnit = () => {
    const availableUnits = getAvailableUnits();
    return availableUnits.find((unit) => unit?._id === leaseData?.unitId);
  };

  const handleUnitChange = (unitId: string) => {
    handleInputChange("unitId", unitId);

    // Auto-fill rent amount and security deposit when unit is selected
    const selectedUnit = getAvailableUnits().find(
      (unit) => unit._id === unitId
    );
    if (selectedUnit) {
      if (selectedUnit.rentAmount) {
        handleInputChange("rentAmount", selectedUnit.rentAmount);
      }
      if (selectedUnit.securityDeposit) {
        handleInputChange("securityDeposit", selectedUnit.securityDeposit);
      }
    }
  };

  const propertyOptions: SearchableSelectOption[] = properties.map(
    (property) => ({
      value: property._id,
      label: property.name,
      subtitle: [property.address?.street, property.address?.city]
        .filter(Boolean)
        .join(", "),
      icon: <Home className="h-4 w-4 text-muted-foreground" />,
    })
  );

  const unitOptions: SearchableSelectOption[] = getAvailableUnits().map(
    (unit) => ({
      value: unit._id,
      label: t("leases.new.form.sections.propertyTenant.unitLabel", {
        values: { unitNumber: unit.unitNumber },
      }),
      subtitle: t("leases.new.form.sections.propertyTenant.unitSummary", {
        values: {
          bedrooms: unit.bedrooms ?? 0,
          bathrooms: unit.bathrooms ?? 0,
          rent: formatCurrency(unit.rentAmount ?? 0),
          perMonth: t("leases.labels.perMonth"),
        },
      }),
    })
  );

  const tenantOptions: SearchableSelectOption[] = tenants.map((tenant) => ({
    value: tenant._id,
    label: `${tenant.firstName} ${tenant.lastName}`,
    subtitle: tenant.email,
    icon: (
      <Avatar className="h-7 w-7 text-xs">
        <AvatarFallback>
          {getInitials(tenant.firstName, tenant.lastName)}
        </AvatarFallback>
      </Avatar>
    ),
  }));

  const buildContractDraft = () => {
    const property = getSelectedProperty();
    const tenant = tenants.find((item) => item._id === leaseData.tenantId);
    const owner = property?.ownerId || property?.managerId;
    const ownerName = owner?.businessName || [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || "Le Bailleur";
    const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "Le Locataire";
    const address = property ? [property.address?.street, property.address?.city, property.address?.state, property.address?.country].filter(Boolean).join(", ") : "Adresse du bien";
    const fmt = (value: string) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${value}T00:00:00`)) : "[date]";
    return `CONTRAT DE LOCATION

Entre les soussignés :

1. LE BAILLEUR : ${ownerName}
E-mail : ${owner?.email || "[à compléter]"}
Téléphone : ${owner?.phone || "[à compléter]"}

2. LE LOCATAIRE : ${tenantName}
E-mail : ${tenant?.email || "[à compléter]"}

3. L’INTERMÉDIAIRE : GESTION E-IMMO / E-IMMO
La plateforme intervient comme intermédiaire technique et de gestion. Elle ne se substitue pas au bailleur dans ses obligations légales.

PRÉAMBULE
Les parties conviennent de la location du bien décrit ci-dessous. Le présent projet est établi en référence à la loi n° 2022-30 fixant le régime juridique du bail à usage d’habitation en République du Bénin. Il doit être relu et adapté par les parties avant validation et signature.

ARTICLE 1 — DÉSIGNATION DU BIEN
Bien : ${property?.name || "[nom du bien]"}
Type : ${property?.type || "[type du bien]"}
Adresse / localisation : ${address}
Unité : ${getSelectedUnit()?.unitNumber || "[unité]"}

ARTICLE 2 — DURÉE
Le bail prend effet le ${fmt(leaseData.startDate)} et prend fin le ${fmt(leaseData.endDate)}.

ARTICLE 3 — LOYER ET MODALITÉS DE PAIEMENT
Loyer mensuel : ${formatCurrency(leaseData.rentAmount || 0)}.
Échéance mensuelle : le ${leaseData.rentDueDay || 1} de chaque mois. Une quittance ou une preuve de paiement est remise au locataire.

ARTICLE 4 — DÉPÔT DE GARANTIE
Dépôt de garantie : ${formatCurrency(leaseData.securityDeposit || 0)}. Pour un bail d’habitation, le montant doit respecter les plafonds légaux applicables au Bénin.

ARTICLE 5 — ÉTAT DES LIEUX
Un état des lieux contradictoire d’entrée est établi lors de la remise des clés et annexé au présent contrat. Un état des lieux de sortie est établi à la restitution du bien.

ARTICLE 6 — OBLIGATIONS DU BAILLEUR
Le bailleur remet un bien en état d’usage, assure au locataire une jouissance paisible et réalise les réparations qui ne relèvent pas des réparations locatives.

ARTICLE 7 — OBLIGATIONS DU LOCATAIRE
Le locataire paie le loyer et les charges aux échéances convenues, use paisiblement des lieux, entretient le bien, signale les dommages importants et ne sous-loue pas sans autorisation écrite lorsque celle-ci est requise.

ARTICLE 8 — ENTRETIEN, RÉPARATIONS ET CHARGES
Les réparations locatives et charges récupérables sont précisées par les parties :
[À compléter]

ARTICLE 9 — RETARD ET IMPAYÉS
Tout retard est traité conformément au contrat et aux règles légales applicables. Frais de retard convenus : ${formatCurrency(leaseData.lateFeeAmount || 0)}, après un délai de grâce de ${leaseData.lateFeeGracePeriodDays || 0} jour(s).

ARTICLE 10 — RÉSILIATION ET PRÉAVIS
Les conditions de préavis, de mise en demeure, de résiliation et de restitution des clés doivent respecter la législation béninoise applicable et les clauses validées ci-dessous :
[À compléter]

ARTICLE 11 — RÈGLEMENT DES LITIGES
Les parties recherchent d’abord une solution amiable. À défaut, elles peuvent saisir l’organe de conciliation ou la juridiction béninoise compétente.

ARTICLE 12 — ANNEXES
État des lieux, inventaire, pièces d’identité, justificatifs de propriété ou mandat, règlement intérieur et autres pièces convenues.

Fait à [ville], le [date].

LE BAILLEUR                         LE LOCATAIRE                         E-IMMO
Nom et signature                    Nom et signature                    Intermédiaire
`;
  };

  useEffect(() => {
    if (mode === "create" && leaseData.propertyId && leaseData.tenantId && !leaseData.contractText.trim()) {
      setLeaseData((prev) => ({ ...prev, contractText: buildContractDraft() }));
    }
  }, [leaseData.propertyId, leaseData.unitId, leaseData.tenantId, leaseData.startDate, leaseData.endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ok, messages, invalidFields } = validateAll();
    if (!ok) {
      toast.error(
        t("leases.new.form.toasts.validationErrors", {
          values: { errors: messages.join(", ") },
        })
      );
      focusFirstInvalid(invalidFields);
      return;
    }

    if (mode === "edit" && !(leaseId || initialLease?._id)) {
      toast.error(t("leases.new.form.errors.missingLeaseIdentifier"));
      return;
    }

    setSubmitting(true);

    const basePayload = {
      propertyId: leaseData.propertyId,
      unitId: leaseData.unitId,
      tenantId: leaseData.tenantId,
      startDate: leaseData.startDate,
      endDate: leaseData.endDate,
      contractText: leaseData.contractText || buildContractDraft(),
      terms: {
        rentAmount: leaseData.rentAmount,
        securityDeposit: leaseData.securityDeposit,
        lateFee: leaseData.lateFeeAmount,
        utilities: [],
        restrictions: [],
        paymentConfig: {
          rentDueDay: leaseData.rentDueDay,
          lateFeeConfig: {
            enabled: leaseData.lateFeeAmount > 0,
            gracePeriodDays: leaseData.lateFeeGracePeriodDays,
            feeType: leaseData.lateFeeType,
            feeAmount: leaseData.lateFeeAmount,
            compoundDaily: false,
            notificationDays: [3, 7, 14],
          },
          autoGenerateInvoices: leaseData.autoGenerateInvoices,
          autoEmailInvoices: leaseData.autoEmailInvoices,
          autoCreatePayments: true,
          prorationEnabled: true,
          advancePaymentMonths: 0,
        },
      },
    };

    const targetLeaseId = leaseId ?? initialLease?._id;
    const endpoint =
      mode === "edit" && targetLeaseId
        ? `/api/leases/${targetLeaseId}`
        : "/api/leases";
    const method = mode === "edit" ? "PUT" : "POST";
    const payload =
      mode === "edit"
        ? basePayload
        : {
            ...basePayload,
            status: "active" as const,
          };

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            result.message ||
            t("leases.new.form.errors.saveLeaseGeneric")
        );
      }

      const resultLease = result.data?.lease ?? result.data ?? null;
      const resultLeaseId =
        resultLease?._id ??
        targetLeaseId ??
        (typeof result.data?.id === "string" ? result.data.id : undefined);

      if (mode === "edit") {
        toast.success(t("leases.new.form.toasts.updateSuccess"));

        setLeaseError(null);

        if (resultLease) {
          hydrateLeaseData(resultLease);
        } else if (targetLeaseId) {
          void loadLeaseDetails(targetLeaseId);
        }

        if (onSuccess) {
          onSuccess(resultLeaseId);
        } else if (resultLeaseId) {
          window.location.href = `/dashboard/leases/${resultLeaseId}`;
        }
        return;
      }

      toast.success(t("leases.new.form.toasts.createSuccess"));

      if (result.data?.invoiceGeneration) {
        const { invoicesGenerated, errors: invoiceErrors } =
          result.data.invoiceGeneration;
        if (invoicesGenerated > 0) {
          toast.success(
            t("leases.new.form.toasts.invoicesGenerated", {
              values: { count: invoicesGenerated },
            }),
            {
              description: t("leases.new.form.toasts.invoicesAvailable"),
              duration: 6000,
            }
          );
        }
        if (Array.isArray(invoiceErrors) && invoiceErrors.length > 0) {
          toast.warning(
            t("leases.new.form.toasts.invoiceWarnings", {
              values: { warnings: invoiceErrors.join(", ") },
            })
          );
        }
      }

      window.dispatchEvent(new Event("lease-created"));
      window.dispatchEvent(new Event("sidebar-counts-refresh"));
      setLeaseData(createInitialLeaseState());
      setOriginalLeaseData(createInitialLeaseState());

      const navigateAfterCreate = () => {
        if (onSuccess) {
          onSuccess(resultLeaseId);
        } else if (resultLeaseId) {
          window.location.href = `/dashboard/leases/${resultLeaseId}`;
        } else {
          window.location.href = "/dashboard/leases";
        }
      };

      navigateAfterCreate();
    } catch (error) {
      const fallbackMessage = t("leases.new.form.errors.saveLeaseGeneric");
      const message = error instanceof Error ? error.message : fallbackMessage;
      toast.error(
        mode === "edit"
          ? t("leases.new.form.toasts.updateError")
          : t("leases.new.form.toasts.createError"),
        {
          description: message,
          duration: 5000,
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditMode && initializingLease) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {leaseError && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>{leaseError}</span>
              {isEditMode && (leaseId || initialLease?._id) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void loadLeaseDetails(leaseId ?? initialLease?._id ?? "")
                  }
                >
                  {t("leases.new.form.actions.retryLoadLease")}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Property & Tenant Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              {t("leases.new.form.sections.propertyTenant.title")}
            </CardTitle>
            <CardDescription>
              {t("leases.new.form.sections.propertyTenant.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="propertySelect">
                  {t(
                    "leases.new.form.sections.propertyTenant.labels.property",
                    {
                      values: { count: properties.length },
                    }
                  )}
                </Label>
                <SearchableSelect
                  id="propertySelect"
                  value={leaseData.propertyId}
                  onValueChange={(value) => {
                    handleInputChange("propertyId", value);
                    handleInputChange("unitId", ""); // Reset unit when property changes
                  }}
                  options={propertyOptions}
                  placeholder={t(
                    "leases.new.form.sections.propertyTenant.placeholders.property"
                  )}
                  searchPlaceholder={t(
                    "leases.new.form.sections.propertyTenant.search.property",
                    { defaultValue: "Search properties..." }
                  )}
                  emptyMessage={t(
                    "leases.new.form.sections.propertyTenant.messages.noPropertiesFound",
                    { defaultValue: "Aucune propriété trouvée." }
                  )}
                  disabled={loadingProperties}
                />
                {fieldErrors.propertyId && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.propertyId}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitSelect">
                  {leaseData.propertyId
                    ? t(
                        "leases.new.form.sections.propertyTenant.labels.unitWithCount",
                        { values: { count: getAvailableUnits().length } }
                      )
                    : t("leases.new.form.sections.propertyTenant.labels.unit")}
                </Label>
                <SearchableSelect
                  id="unitSelect"
                  value={leaseData.unitId}
                  onValueChange={handleUnitChange}
                  disabled={!leaseData.propertyId || loadingProperties}
                  options={unitOptions}
                  placeholder={
                    !leaseData.propertyId
                      ? t(
                          "leases.new.form.sections.propertyTenant.placeholders.selectPropertyFirst"
                        )
                      : loadingProperties
                      ? t(
                          "leases.new.form.sections.propertyTenant.placeholders.loadingUnits"
                        )
                      : getAvailableUnits().length === 0
                      ? t(
                          "leases.new.form.sections.propertyTenant.placeholders.noUnits"
                        )
                      : t(
                          "leases.new.form.sections.propertyTenant.placeholders.unit"
                        )
                  }
                  searchPlaceholder={t(
                    "leases.new.form.sections.propertyTenant.search.unit",
                    { defaultValue: "Search units..." }
                  )}
                  emptyMessage={
                    leaseData.propertyId
                      ? t(
                          "leases.new.form.sections.propertyTenant.messages.noUnitsInProperty"
                        )
                      : t(
                          "leases.new.form.sections.propertyTenant.placeholders.selectPropertyFirst"
                        )
                  }
                />
                {fieldErrors.unitId && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.unitId}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantSelect">
                {t("leases.new.form.sections.propertyTenant.labels.tenant")}
              </Label>
              <SearchableSelect
                id="tenantSelect"
                value={leaseData.tenantId}
                onValueChange={(value) => handleInputChange("tenantId", value)}
                options={tenantOptions}
                placeholder={t(
                  "leases.new.form.sections.propertyTenant.placeholders.tenant"
                )}
                searchPlaceholder={t(
                  "leases.new.form.sections.propertyTenant.search.tenant",
                  { defaultValue: "Search tenants..." }
                )}
                emptyMessage={t(
                  "leases.new.form.sections.propertyTenant.messages.noTenantFound",
                  { defaultValue: "Aucun locataire trouvé." }
                )}
              />
              {fieldErrors.tenantId && (
                <p className="text-destructive text-sm">
                  {fieldErrors.tenantId}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Unit Details */}
        {leaseData.unitId && getSelectedUnit() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-primary">
                {t("leases.new.form.sections.selectedUnit.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {t("leases.new.form.sections.selectedUnit.labels.unit")}
                  </div>
                  <div className="font-medium">
                    {getSelectedUnit()?.unitNumber} (
                    {getSelectedUnit()?.unitType})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {t("leases.new.form.sections.selectedUnit.labels.size")}
                  </div>
                  <div className="font-medium">
                    {t("leases.new.form.sections.selectedUnit.sizeValue", {
                      values: {
                        bedrooms: getSelectedUnit()?.bedrooms ?? 0,
                        bathrooms: getSelectedUnit()?.bathrooms ?? 0,
                      },
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {t("leases.new.form.sections.selectedUnit.labels.area")}
                  </div>
                  <div className="font-medium">
                    {t("leases.new.form.sections.selectedUnit.areaValue", {
                      values: { area: getSelectedUnit()?.squareFootage ?? 0 },
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {t("leases.new.form.sections.selectedUnit.labels.rent")}
                  </div>
                  <div className="font-medium text-green-600">
                    {t("leases.new.form.sections.selectedUnit.rentValue", {
                      values: {
                        amount: formatCurrency(
                          getSelectedUnit()?.rentAmount ?? 0
                        ),
                        perMonth: t("leases.labels.perMonth"),
                      },
                    })}
                  </div>
                </div>
              </div>
              {(getSelectedUnit()?.rentAmount ||
                getSelectedUnit()?.securityDeposit) && (
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {t("leases.new.form.sections.selectedUnit.autoFillNote")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Lease Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("leases.new.form.sections.dates.title")}
            </CardTitle>
            <CardDescription>
              {t("leases.new.form.sections.dates.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  {t("leases.new.form.sections.dates.labels.startDate")}
                </Label>
                <FormDatePicker
                  id="startDatePicker"
                  key={`start-date-${leaseData.startDate}`}
                  value={
                    leaseData.startDate
                      ? new Date(leaseData.startDate + "T00:00:00")
                      : undefined
                  }
                  onChange={(date) => {
                    if (date) {
                      // Create a new date to avoid timezone issues
                      const localDate = new Date(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      );
                      handleInputChange(
                        "startDate",
                        format(localDate, "yyyy-MM-dd")
                      );
                    } else {
                      handleInputChange("startDate", "");
                    }
                  }}
                  placeholder={t(
                    "leases.new.form.sections.dates.placeholders.startDate"
                  )}
                  fromYear={LEASE_DATE_FROM_YEAR}
                  toYear={new Date().getFullYear() + 15}
                />
                {fieldErrors.startDate && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.startDate}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">
                  {t("leases.new.form.sections.dates.labels.endDate")}
                </Label>
                <FormDatePicker
                  id="endDatePicker"
                  key={`end-date-${leaseData.endDate}-${leaseData.startDate}`}
                  value={
                    leaseData.endDate
                      ? new Date(leaseData.endDate + "T00:00:00")
                      : undefined
                  }
                  onChange={(date) => {
                    if (date) {
                      // Create a new date to avoid timezone issues
                      const localDate = new Date(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      );
                      handleInputChange(
                        "endDate",
                        format(localDate, "yyyy-MM-dd")
                      );
                    } else {
                      handleInputChange("endDate", "");
                    }
                  }}
                  placeholder={t(
                    "leases.new.form.sections.dates.placeholders.endDate"
                  )}
                  toYear={new Date().getFullYear() + 15}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);

                    if (!leaseData.startDate) return checkDate < today;

                    const startDate = new Date(
                      leaseData.startDate + "T00:00:00"
                    );
                    startDate.setHours(0, 0, 0, 0);
                    return checkDate <= startDate;
                  }}
                  fromYear={
                    leaseData.startDate
                      ? new Date(
                          leaseData.startDate + "T00:00:00"
                        ).getFullYear()
                      : new Date().getFullYear()
                  }
                  toYear={new Date().getFullYear() + 10}
                />
                {fieldErrors.endDate && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.endDate}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t("leases.details.financial.title")}
            </CardTitle>
            <CardDescription>
              {t("leases.new.form.sections.financial.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="rentAmount">
                  {t("leases.details.financial.monthlyRent")}
                </Label>
                <Input
                  id="rentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={leaseData.rentAmount}
                  onChange={(e) =>
                    handleInputChange(
                      "rentAmount",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="2000,00"
                  required
                />
                {fieldErrors.rentAmount && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.rentAmount}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="securityDeposit">
                  {t("leases.details.financial.securityDeposit")}
                </Label>
                <Input
                  id="securityDeposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={leaseData.securityDeposit}
                  onChange={(e) =>
                    handleInputChange(
                      "securityDeposit",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="2000,00"
                />
                {fieldErrors.securityDeposit && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.securityDeposit}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentDueDay">
                  {t("leases.new.form.sections.financial.labels.rentDueDay")}
                </Label>
                <Select
                  value={leaseData.rentDueDay.toString()}
                  onValueChange={(value) =>
                    handleInputChange("rentDueDay", parseInt(value))
                  }
                >
                  <SelectTrigger id="rentDueDaySelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {t(
                          "leases.new.form.sections.financial.labels.rentDueDayOption",
                          { values: { day } }
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Late Fee Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("leases.new.form.sections.lateFees.title")}
            </CardTitle>
            <CardDescription>
              {t("leases.new.form.sections.lateFees.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lateFeeAmount">
                  {t("leases.new.form.sections.lateFees.labels.amount")}
                </Label>
                <Input
                  id="lateFeeAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={leaseData.lateFeeAmount}
                  onChange={(e) =>
                    handleInputChange(
                      "lateFeeAmount",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="50,00"
                />
                {fieldErrors.lateFeeAmount && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.lateFeeAmount}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateFeeGracePeriodDays">
                  {t("leases.new.form.sections.lateFees.labels.gracePeriod")}
                </Label>
                <Input
                  id="lateFeeGracePeriodDays"
                  type="number"
                  min="0"
                  value={leaseData.lateFeeGracePeriodDays}
                  onChange={(e) =>
                    handleInputChange(
                      "lateFeeGracePeriodDays",
                      parseInt(e.target.value) || 0
                    )
                  }
                  placeholder="5"
                />
                {fieldErrors.lateFeeGracePeriodDays && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.lateFeeGracePeriodDays}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateFeeType">
                  {t("leases.new.form.sections.lateFees.labels.type")}
                </Label>
                <Select
                  value={leaseData.lateFeeType}
                  onValueChange={(value: "fixed" | "percentage") =>
                    handleInputChange("lateFeeType", value)
                  }
                >
                  <SelectTrigger id="lateFeeTypeSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">
                      {t(
                        "leases.new.form.sections.lateFees.options.fixedAmount"
                      )}
                    </SelectItem>
                    <SelectItem value="percentage">
                      {t(
                        "leases.new.form.sections.lateFees.options.percentageOfRent"
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {t("leases.new.form.sections.automation.title")}
            </CardTitle>
            <CardDescription>
              {t("leases.new.form.sections.automation.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoGenerateInvoices">
                  {t("leases.new.form.sections.automation.labels.autoGenerate")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("leases.new.form.sections.automation.help.autoGenerate")}
                </p>
              </div>
              <Switch
                id="autoGenerateInvoices"
                checked={leaseData.autoGenerateInvoices}
                onCheckedChange={(checked) =>
                  handleInputChange("autoGenerateInvoices", checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoEmailInvoices">
                  {t("leases.new.form.sections.automation.labels.autoEmail")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("leases.new.form.sections.automation.help.autoEmail")}
                </p>
              </div>
              <Switch
                id="autoEmailInvoices"
                checked={leaseData.autoEmailInvoices}
                onCheckedChange={(checked) =>
                  handleInputChange("autoEmailInvoices", checked)
                }
                disabled={!leaseData.autoGenerateInvoices}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrat de location modifiable</CardTitle>
            <CardDescription>
              Projet prérempli avec le bailleur, le locataire, E-IMMO, le bien et les conditions financières. Relisez et adaptez le texte avant validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              id="contractText"
              value={leaseData.contractText}
              onChange={(event) => handleInputChange("contractText", event.target.value)}
              className="min-h-[520px] w-full resize-y rounded-xl border bg-background p-4 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Le contrat prérempli apparaîtra ici après la sélection du bien et du locataire."
            />
            <p className="text-xs text-muted-foreground">
              Ce modèle facilite la préparation du bail, mais ne constitue pas un avis juridique. Les parties doivent vérifier le texte final avant signature.
            </p>
          </CardContent>
        </Card>

        {/* Summary & Submit */}
        <Card>
          <CardHeader>
            <CardTitle>{t("leases.new.form.sections.review.title")}</CardTitle>
            <CardDescription>
              {t("leases.new.form.sections.review.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {leaseData.autoGenerateInvoices && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("leases.new.form.sections.review.invoicesSummary", {
                    values: {
                      depositPart:
                        leaseData.securityDeposit > 0
                          ? t(
                              "leases.new.form.sections.review.fragments.securityDeposit"
                            )
                          : "",
                      emailPart: leaseData.autoEmailInvoices
                        ? t(
                            "leases.new.form.sections.review.fragments.autoEmail"
                          )
                        : "",
                    },
                  })}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isEditMode) {
                    setLeaseData({ ...originalLeaseData });
                  } else {
                    const resetState = createInitialLeaseState();
                    setLeaseData(resetState);
                    setOriginalLeaseData(createInitialLeaseState());
                  }
                }}
                disabled={submitting || (isEditMode && initializingLease)}
              >
                {resetLabel}
              </Button>

              <Button
                type="submit"
                disabled={submitting || (isEditMode && initializingLease)}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {submitLoadingLabel}
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
