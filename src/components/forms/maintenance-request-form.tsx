"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useState, useEffect, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/image-upload";
import { DatePicker } from "@/components/ui/date-picker";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
  Wrench,
  AlertTriangle,
  Building2,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { MaintenancePriority } from "@/types";
import { formatRoleLabel } from "@/lib/permissions-manager";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

// Form validation schema
const maintenanceRequestFormSchema = z.object({
  title: z.string().min(1, "Le titre est obligatoire").max(100, "Le titre est trop long"),
  description: z
    .string()
    .min(10, "La description doit contenir au moins 10 caractères")
    .max(1000, "La description est trop longue"),
  category: z.string().min(1, "La catégorie est obligatoire"),
  priority: z.nativeEnum(MaintenancePriority),
  propertyId: z.string().min(1, "La propriété est obligatoire"),
  unitId: z.string().optional(),
  tenantId: z.string().min(1, "Le locataire est obligatoire"),
  assignedTo: z.string().optional(),
  estimatedCost: z.number().min(0, "Le coût ne peut pas être négatif").optional(),
  scheduledDate: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      return !isNaN(Date.parse(date));
    }, "Format de date invalide"),
  images: z.array(z.string()).optional(),
});

type MaintenanceRequestFormData = z.infer<typeof maintenanceRequestFormSchema>;

interface MaintenanceRequestFormProps {
  onSubmit: (data: MaintenanceRequestFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<MaintenanceRequestFormData>;
  isTenantView?: boolean;
  showPropertyTenantSection?: boolean;
  showAssignmentSchedulingSection?: boolean;
  showAssigneeField?: boolean;
  defaultAssigneeLabel?: string;
  submitLabel?: string;
  submitDisabled?: boolean;
  properties?: Array<{
    id: string;
    name: string;
    address: string;
    isMultiUnit?: boolean;
    units?: Array<{
      _id: string;
      unitNumber: string;
      unitType: string;
      status: string;
      currentTenantId?: string;
      currentLeaseId?: string;
    }>;
  }>;
  tenants?: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    unitNumber?: string;
    unitType?: string;
    leaseStatus?: string;
    propertyName?: string;
  }>;
  technicians?: Array<{
    id: string;
    name: string;
    email: string;
    role?: string;
    specialties?: string[];
  }>;
}

const maintenanceCategories = [
  { key: "plumbing", value: "Plumbing" },
  { key: "electrical", value: "Electrical" },
  { key: "hvac", value: "HVAC" },
  { key: "appliances", value: "Appliances" },
  { key: "flooring", value: "Flooring" },
  { key: "painting", value: "Painting" },
  { key: "roofing", value: "Roofing" },
  { key: "windows", value: "Windows" },
  { key: "doors", value: "Doors" },
  { key: "landscaping", value: "Landscaping" },
  { key: "cleaning", value: "Cleaning" },
  { key: "pestControl", value: "Pest Control" },
  { key: "security", value: "Sécurité" },
  { key: "generalRepair", value: "General Repair" },
  { key: "emergency", value: "Emergency" },
  { key: "other", value: "Autre" },
];

export function MaintenanceRequestForm({
  onSubmit,
  isLoading = false,
  initialData,
  isTenantView = false,
  showPropertyTenantSection,
  showAssignmentSchedulingSection,
  showAssigneeField = true,
  defaultAssigneeLabel = "E-IMMO — Staff Gestion E-Immo",
  submitLabel,
  submitDisabled = false,
  properties = [],
  tenants = [],
  technicians = [],
}: MaintenanceRequestFormProps) {
  const { t } = useLocalizationContext();
  const getDisplayUnitStatus = (unit: {
    status: string;
    currentTenantId?: string;
    currentLeaseId?: string;
  }) => {
    const normalizedStatus = (unit.status || "").toLowerCase();
    if (
      normalizedStatus === "occupied" &&
      (!unit.currentTenantId || !unit.currentLeaseId)
    ) {
      return t("maintenance.form.unit.statusNeedsSync", {
        defaultValue: "synchronisation requise",
      });
    }

    return unit.status;
  };
  const maintenanceCategoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      maintenanceCategories.map((category) => ({
        value: category.value,
        label: t(`maintenance.categories.${category.key}`),
      })),
    [t]
  );
  const propertyOptions = useMemo<SearchableSelectOption[]>(
    () =>
      properties.map((property) => ({
        value: property.id,
        label: property.name,
        subtitle: property.address,
        badge: property.isMultiUnit
          ? t("maintenance.form.property.multiUnit")
          : undefined,
      })),
    [properties, t]
  );
  const technicianOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: "UNASSIGNED",
        label: t("maintenance.form.assignedTo.unassigned"),
      },
      ...technicians.map((tech) => ({
        value: tech.id,
        label: tech.name,
        subtitle: tech.email,
        badge: tech.role ? formatRoleLabel(tech.role) : undefined,
      })),
    ],
    [technicians, t]
  );
  const [hasInitialized, setHasInitialized] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<
    { url: string; publicId: string }[]
  >((initialData?.images || []).map((url) => ({ url, publicId: "" })));

  const [availableUnits, setAvailableUnits] = useState<
    Array<{
      _id: string;
      unitNumber: string;
      unitType: string;
      status: string;
      currentTenantId?: string;
      currentLeaseId?: string;
    }>
  >([]);

  const [filteredTenants, setFilteredTenants] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      phone?: string;
      avatar?: string;
      unitNumber?: string;
      unitType?: string;
      leaseStatus?: string;
      propertyName?: string;
    }>
  >([]);

  const [loadingTenants, setLoadingTenants] = useState(false);
  const unitOptions = useMemo<SearchableSelectOption[]>(
    () =>
      availableUnits.map((unit) => ({
        value: unit._id,
        label: `Unité ${unit.unitNumber}`,
        subtitle: `${unit.unitType} • ${getDisplayUnitStatus(unit)}`,
      })),
    [availableUnits, t]
  );
  const tenantOptions = useMemo<SearchableSelectOption[]>(
    () =>
      filteredTenants.map((tenant) => ({
        value: tenant.id,
        label: tenant.name,
        subtitle: tenant.email,
        badge: tenant.unitNumber
          ? `Unité ${tenant.unitNumber}${
              tenant.unitType ? ` (${tenant.unitType})` : ""
            }`
          : tenant.leaseStatus
          ? `${tenant.leaseStatus} ${t("maintenance.form.tenant.lease")}`
          : undefined,
      })),
    [filteredTenants, t]
  );

  const form = useForm<MaintenanceRequestFormData>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      category: initialData?.category || "",
      priority: initialData?.priority || MaintenancePriority.MEDIUM,
      propertyId: initialData?.propertyId || "",
      unitId: initialData?.unitId || "",
      tenantId: initialData?.tenantId || "",
      assignedTo: initialData?.assignedTo || "",
      estimatedCost: initialData?.estimatedCost || undefined,
      scheduledDate: initialData?.scheduledDate || "",
      images: initialData?.images || [],
    },
  });

  const watchedPriority = form.watch("priority");
  const watchedCategory = form.watch("category");
  const watchedPropertyId = form.watch("propertyId");
  const watchedUnitId = form.watch("unitId");

  useEffect(() => {
    if (!initialData) {
      return;
    }

    if (initialData.propertyId) {
      form.setValue("propertyId", initialData.propertyId);
    }

    if (initialData.unitId !== undefined) {
      form.setValue("unitId", initialData.unitId || "");
    }

    if (initialData.tenantId) {
      form.setValue("tenantId", initialData.tenantId);
    }
  }, [
    form,
    initialData?.propertyId,
    initialData?.tenantId,
    initialData?.unitId,
  ]);

  const [prevPropertyId, setPrevPropertyId] = useState<string | undefined>(
    undefined
  );
  const [prevUnitId, setPrevUnitId] = useState<string | undefined>(undefined);
  const tenantFetchKeyRef = useRef<string | null>(null);

  // Function to fetch tenants for a specific property
  const fetchPropertyTenants = async (propertyId: string, unitId?: string) => {
    const requestKey = `${propertyId}:${unitId || "all"}`;
    if (tenantFetchKeyRef.current === requestKey) {
      return;
    }

    tenantFetchKeyRef.current = requestKey;

    try {
      setLoadingTenants(true);
      const url = new URL(
        `/api/properties/${propertyId}/tenants`,
        window.location.origin
      );
      if (unitId) {
        url.searchParams.set("unitId", unitId);
      }
      url.searchParams.set("status", "active");

      const response = await fetch(url.toString());

      if (response.ok) {
        const data = await response.json();
        // Handle both possible response structures
        const apiTenants = data?.data?.tenants || data?.tenants || [];

        // Map API response to expected format
        let mappedTenants = apiTenants
          .filter((tenant: any) => tenant && (tenant.id || tenant._id)) // Filter out invalid entries
          .map((tenant: any) => ({
            id: tenant.id || tenant._id,
            name:
              `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() ||
              "Locataire",
            email: tenant.email || "",
            phone: tenant.phone || "",
            avatar: tenant.avatar,
            unitNumber: tenant.unit?.unitNumber,
            unitType: tenant.unit?.type,
            leaseStatus: tenant.lease?.status,
            propertyName: undefined, // Not needed since we're filtering by property
          }));

        // Ensure currently selected tenant remains available in the dropdown
        const currentTenantId =
          form.getValues("tenantId") || initialData?.tenantId || "";
        if (
          currentTenantId &&
          !mappedTenants.some((t: any) => t.id === currentTenantId)
        ) {
          const fallbackTenant = tenants.find((t) => t.id === currentTenantId);
          if (fallbackTenant) {
            mappedTenants = [{ ...fallbackTenant }, ...mappedTenants];
          }
        }

        setFilteredTenants(mappedTenants);

        // Show success message if tenants found
        if (mappedTenants.length > 0) {
          toast.success(
            t("maintenance.form.toasts.tenantsFound", {
              values: { count: mappedTenants.length },
            }),
            { id: `maintenance-tenants-found-${requestKey}` }
          );
        } else {
          const selectedProperty = properties.find((p) => p.id === propertyId);
          const selectedUnit = unitId
            ? selectedProperty?.units?.find((unit) => unit._id === unitId)
            : undefined;
          const isOccupiedWithoutActiveLease = Boolean(
            unitId &&
              selectedUnit &&
              selectedUnit.status?.toLowerCase() === "occupied" &&
              (!selectedUnit.currentTenantId || !selectedUnit.currentLeaseId)
          );

          setFilteredTenants([]);

          toast.info(
            isOccupiedWithoutActiveLease
              ? t("maintenance.form.toasts.occupiedUnitNoActiveTenant", {
                    defaultValue:
                      "Cette unité est occupée, mais aucun locataire lié à un bail actif n’a été trouvé.",
                })
              : unitId
              ? t("maintenance.form.toasts.noTenantsFoundForUnit", {
                  defaultValue: "Aucun locataire actif trouvé pour l’unité sélectionnée.",
                })
              : t("maintenance.form.toasts.noTenantsFoundForProperty", {
                  defaultValue:
                    "Aucun locataire actif trouvé pour la propriété sélectionnée.",
                }),
            {
              id: `maintenance-no-tenants-${requestKey}`,
            }
          );
        }
      } else {
        console.error("Failed to fetch property tenants:", response.status);
        // Fall back to showing all tenants
        setFilteredTenants(tenants);
        toast.error(t("maintenance.form.toasts.loadTenantsFailed"), {
          id: `maintenance-tenants-load-failed-${requestKey}`,
        });
      }
    } catch (error) {
      console.error("Error fetching property tenants:", error);
      // Fall back to showing all tenants
      setFilteredTenants(tenants);
      toast.error(t("maintenance.form.toasts.loadTenantsError"), {
        id: `maintenance-tenants-load-error-${requestKey}`,
      });
    } finally {
      setLoadingTenants(false);
    }
  };

  // Initialize filtered tenants - always show all tenants initially
  useEffect(() => {
    // Always show all tenants when tenants list changes
    // Property-specific filtering will override this when a property is selected
    setFilteredTenants(tenants);
  }, [tenants]);

  // Update available units and filter tenants when property changes
  useEffect(() => {
    if (watchedPropertyId) {
      const selectedProperty = properties.find(
        (p) => p.id === watchedPropertyId
      );

      // Handle units for multi-unit properties
      if (selectedProperty?.isMultiUnit && selectedProperty.units) {
        setAvailableUnits(selectedProperty.units);
      } else {
        setAvailableUnits([]);
        form.setValue("unitId", ""); // Clear unit selection for single-unit properties
      }

      // Note: Tenant fetching is handled by the dedicated effect below to avoid duplicate calls

      // Pour un locataire, le compte connecté reste toujours associé à la
      // propriété choisie. Pour le personnel, le changement de propriété
      // réinitialise normalement le locataire afin d'éviter les mélanges.
      if (
        !isTenantView &&
        hasInitialized &&
        prevPropertyId &&
        prevPropertyId !== watchedPropertyId
      ) {
        form.setValue("tenantId", "");
      }
      if (isTenantView) {
        const tenantId = initialData?.tenantId || tenants[0]?.id || "";
        if (tenantId && form.getValues("tenantId") !== tenantId) {
          form.setValue("tenantId", tenantId);
        }

        const leasedUnits = selectedProperty?.units ?? [];
        const currentUnitId = form.getValues("unitId");
        const currentUnitStillMatches = leasedUnits.some(
          (unit) => unit._id === currentUnitId
        );
        if (!currentUnitStillMatches) {
          form.setValue(
            "unitId",
            leasedUnits.length === 1 ? leasedUnits[0]._id : ""
          );
        }
      }
      setPrevPropertyId(watchedPropertyId);
    } else {
      tenantFetchKeyRef.current = null;
      setAvailableUnits([]);
      setFilteredTenants(tenants); // Show all tenants when no property is selected
      form.setValue("unitId", "");
      if (hasInitialized) {
        form.setValue("tenantId", "");
      }
    }
  }, [
    watchedPropertyId,
    properties,
    // form, // Removed form from dependencies to prevent infinite loops
    tenants,
    hasInitialized,
    prevPropertyId,
    isTenantView,
    initialData?.tenantId,
  ]);

  // Update tenant filtering when unit changes
  useEffect(() => {
    if (!isTenantView) {
      if (watchedPropertyId && watchedUnitId) {
        fetchPropertyTenants(watchedPropertyId, watchedUnitId);
        if (hasInitialized && prevUnitId && prevUnitId !== watchedUnitId) {
          form.setValue("tenantId", "");
        }
        setPrevUnitId(watchedUnitId);
      } else if (watchedPropertyId) {
        fetchPropertyTenants(watchedPropertyId);
      }
    }
  }, [
    watchedUnitId,
    watchedPropertyId,
    hasInitialized,
    prevUnitId,
    isTenantView,
  ]);

  // Mark initialized after first render so default values don't trigger clearing
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [hasInitialized]);

  const handleFormSubmit = (data: MaintenanceRequestFormData) => {
    try {
      // Enhanced validation with better error messages
      if (!data.title?.trim()) {
        toast.error(t("maintenance.form.validation.titleRequired"));
        form.setFocus("title");
        return;
      }

      if (!data.description?.trim()) {
        toast.error(t("maintenance.form.validation.descriptionRequired"));
        form.setFocus("description");
        return;
      }

      if (!data.propertyId) {
        toast.error(t("maintenance.form.validation.propertyRequired"));
        form.setFocus("propertyId");
        return;
      }

      if (!data.tenantId) {
        toast.error(t("maintenance.form.validation.tenantRequired"));
        form.setFocus("tenantId");
        return;
      }

      if (!data.category) {
        toast.error(t("maintenance.form.validation.categoryRequired"));
        form.setFocus("category");
        return;
      }

      // Check if property has units but no unit is selected
      const selectedProperty = properties.find((p) => p.id === data.propertyId);
      if (
        selectedProperty?.isMultiUnit &&
        selectedProperty.units &&
        selectedProperty.units.length > 0 &&
        !data.unitId
      ) {
        toast.error(t("maintenance.form.validation.unitRequired"));
        form.setFocus("unitId");
        return;
      }

      const formattedData = {
        ...data,
        images: uploadedImages.map((img) => img.url),
        // Convert scheduledDate to ISO string if provided
        scheduledDate: data.scheduledDate
          ? new Date(data.scheduledDate).toISOString()
          : undefined,
      };
      onSubmit(formattedData);
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error(t("maintenance.form.validation.submitError"));
    }
  };

  return (
    <div className="w-full space-y-8">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-8"
        >
          {/* Request Details */}
          <Card className="border-0 shadow-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <Wrench className="h-5 w-5" />
                </div>
                {t("maintenance.form.requestDetails.title")}
              </CardTitle>
              <CardDescription className="text-base">
                {t("maintenance.form.requestDetails.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {t("maintenance.form.title.label")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("maintenance.form.title.placeholder")}
                        className="h-11 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500 text-sm" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t("maintenance.form.category.label")}
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={maintenanceCategoryOptions}
                          placeholder={t(
                            "maintenance.form.category.placeholder"
                          )}
                          searchPlaceholder={t(
                            "maintenance.form.category.searchPlaceholder",
                            {
                              defaultValue: "Rechercher des catégories…",
                            }
                          )}
                          emptyMessage={t(
                            "maintenance.form.category.emptyMessage",
                            {
                              defaultValue: "Aucune catégorie trouvée.",
                            }
                          )}
                          triggerClassName="h-11 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        />
                      </FormControl>
                      <FormMessage className="text-red-500 text-sm" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t("maintenance.form.priority.label")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200">
                            <SelectValue
                              placeholder={t(
                                "maintenance.form.priority.placeholder"
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={MaintenancePriority.EMERGENCY}>
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                              {t("maintenance.form.priority.emergency")}
                            </div>
                          </SelectItem>
                          <SelectItem value={MaintenancePriority.HIGH}>
                            <div className="flex items-center">
                              <div className="h-2 w-2 rounded-full bg-orange-500 mr-2" />
                              {t("maintenance.form.priority.high")}
                            </div>
                          </SelectItem>
                          <SelectItem value={MaintenancePriority.MEDIUM}>
                            <div className="flex items-center">
                              <div className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                              {t("maintenance.form.priority.medium")}
                            </div>
                          </SelectItem>
                          <SelectItem value={MaintenancePriority.LOW}>
                            <div className="flex items-center">
                              <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                              {t("maintenance.form.priority.low")}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-500 text-sm" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {t("maintenance.form.description.label")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "maintenance.form.description.placeholder"
                        )}
                        className="resize-none border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500 text-sm" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {(showPropertyTenantSection ?? !isTenantView) && (
            <Card className="border-0 shadow-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {t("maintenance.form.propertyTenant.title")}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("maintenance.form.propertyTenant.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  className={`grid gap-6 ${
                    availableUnits.length > 0
                      ? "grid-cols-1 md:grid-cols-3"
                      : "grid-cols-1 md:grid-cols-2"
                  }`}
                >
                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t("maintenance.form.property.label")}
                        </FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={propertyOptions}
                            placeholder={t(
                              "maintenance.form.property.placeholder"
                            )}
                            searchPlaceholder={t(
                              "maintenance.form.property.searchPlaceholder",
                              {
                                defaultValue: "Rechercher des biens…",
                              }
                            )}
                            emptyMessage={t(
                              "maintenance.form.property.emptyMessage",
                              {
                                defaultValue: "Aucune propriété trouvée.",
                              }
                            )}
                            triggerClassName="h-11 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                          />
                        </FormControl>
                        <FormMessage className="text-red-500 text-sm" />
                      </FormItem>
                    )}
                  />

                  {/* Unit Selection - Only show for multi-unit properties */}
                  {availableUnits.length > 0 && (
                    <FormField
                      control={form.control}
                      name="unitId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("maintenance.form.unit.label")}
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              options={unitOptions}
                              placeholder={t("maintenance.form.unit.placeholder")}
                              searchPlaceholder={t(
                                "maintenance.form.unit.searchPlaceholder",
                                {
                                  defaultValue: "Rechercher des logements…",
                                }
                              )}
                              emptyMessage={t(
                                "maintenance.form.unit.emptyMessage",
                                {
                                  defaultValue: "Aucune unité trouvée.",
                                }
                              )}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="tenantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t("maintenance.form.tenant.label")}
                        </FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={tenantOptions}
                            placeholder={t("maintenance.form.tenant.placeholder")}
                            searchPlaceholder={t(
                              "maintenance.form.tenant.searchPlaceholder",
                              {
                                defaultValue: "Rechercher des locataires…",
                              }
                            )}
                            emptyMessage={
                              loadingTenants
                                ? t("maintenance.form.tenant.loading")
                                : watchedUnitId
                                ? t(
                                    "maintenance.form.tenant.noTenantsForUnit",
                                    {
                                      defaultValue:
                                        "Aucun locataire trouvé pour l’unité sélectionnée",
                                    }
                                  )
                                : watchedPropertyId
                                ? t(
                                    "maintenance.form.tenant.noTenantsForProperty"
                                  )
                                : tenants.length > 0
                                ? t(
                                    "maintenance.form.tenant.noTenantsAvailable"
                                  )
                                : t("maintenance.form.tenant.loading")
                            }
                            disabled={loadingTenants}
                            triggerClassName="h-11 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                          />
                        </FormControl>
                        <FormMessage className="text-red-500 text-sm" />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {(showAssignmentSchedulingSection ?? !isTenantView) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t("maintenance.form.assignment.title")}
                </CardTitle>
                <CardDescription>
                  {t("maintenance.form.assignment.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {showAssigneeField ? (
                    <FormField
                      control={form.control}
                      name="assignedTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("maintenance.form.assignedTo.label")}
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              value={field.value || "UNASSIGNED"}
                              onValueChange={(value) =>
                                field.onChange(value === "UNASSIGNED" ? "" : value)
                              }
                              options={technicianOptions}
                              placeholder={t(
                                "maintenance.form.assignedTo.placeholder"
                              )}
                              searchPlaceholder={t(
                                "maintenance.form.assignedTo.searchPlaceholder",
                                { defaultValue: "Rechercher un technicien..." }
                              )}
                              emptyMessage={t(
                                "maintenance.form.assignedTo.emptyMessage",
                                { defaultValue: "Aucun technicien trouvé." }
                              )}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormItem>
                      <FormLabel>Affectation initiale</FormLabel>
                      <Input value={defaultAssigneeLabel} disabled readOnly />
                      <p className="text-xs text-muted-foreground">
                        La demande sera reçue par le staff E-IMMO. Le Super administrateur pourra ensuite l’affecter à un technicien.
                      </p>
                    </FormItem>
                  )}

                  <FormField
                    control={form.control}
                    name="estimatedCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("maintenance.form.estimatedCost.label")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={t(
                              "maintenance.form.estimatedCost.placeholder"
                            )}
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                parseFloat(e.target.value) || undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("maintenance.form.scheduledDate.label")}
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <DatePicker
                              date={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={(selectedDate) => {
                                if (!selectedDate) {
                                  field.onChange("");
                                  return;
                                }

                                const currentValue = field.value
                                  ? new Date(field.value)
                                  : undefined;
                                const hours = currentValue && !Number.isNaN(currentValue.getTime())
                                  ? currentValue.getHours()
                                  : 9;
                                const minutes = currentValue && !Number.isNaN(currentValue.getTime())
                                  ? currentValue.getMinutes()
                                  : 0;

                                selectedDate.setHours(hours, minutes, 0, 0);
                                const pad = (value: number) => String(value).padStart(2, "0");
                                field.onChange(
                                  `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}T${pad(hours)}:${pad(minutes)}`
                                );
                              }}
                              fromYear={new Date().getFullYear()}
                              toYear={new Date().getFullYear() + 15}
                              placeholder={t(
                                "maintenance.form.scheduledDate.placeholder"
                              )}
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <select
                                aria-label="Heure"
                                className="h-11 min-w-0 rounded-md border-2 border-border/60 bg-background px-3 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!field.value}
                                value={
                                  field.value && !Number.isNaN(new Date(field.value).getTime())
                                    ? String(new Date(field.value).getHours()).padStart(2, "0")
                                    : "09"
                                }
                                onChange={(event) => {
                                  if (!field.value) return;
                                  const date = new Date(field.value);
                                  if (Number.isNaN(date.getTime())) return;
                                  date.setHours(Number(event.target.value), date.getMinutes(), 0, 0);
                                  const pad = (value: number) => String(value).padStart(2, "0");
                                  field.onChange(
                                    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
                                  );
                                }}
                              >
                                {Array.from({ length: 24 }, (_, hour) => (
                                  <option key={hour} value={String(hour).padStart(2, "0")}>
                                    {String(hour).padStart(2, "0")} h
                                  </option>
                                ))}
                              </select>

                              <select
                                aria-label="Minutes"
                                className="h-11 min-w-0 rounded-md border-2 border-border/60 bg-background px-3 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!field.value}
                                value={
                                  field.value && !Number.isNaN(new Date(field.value).getTime())
                                    ? String(new Date(field.value).getMinutes()).padStart(2, "0")
                                    : "00"
                                }
                                onChange={(event) => {
                                  if (!field.value) return;
                                  const date = new Date(field.value);
                                  if (Number.isNaN(date.getTime())) return;
                                  date.setMinutes(Number(event.target.value), 0, 0);
                                  const pad = (value: number) => String(value).padStart(2, "0");
                                  field.onChange(
                                    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
                                  );
                                }}
                              >
                                {[0, 15, 30, 45].map((minute) => (
                                  <option key={minute} value={String(minute).padStart(2, "0")}>
                                    {String(minute).padStart(2, "0")} min
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                {t("maintenance.form.photos.title")}
              </CardTitle>
              <CardDescription>
                {t("maintenance.form.photos.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                onImagesUploaded={(newImages) => {
                  const updatedImages = [...uploadedImages, ...newImages];
                  setUploadedImages(updatedImages);
                  form.setValue(
                    "images",
                    updatedImages.map((img) => img.url)
                  );
                }}
                onImagesRemoved={(removedImages) => {
                  const updatedImages = uploadedImages.filter(
                    (img) =>
                      !removedImages.some(
                        (removed) => removed.publicId === img.publicId
                      )
                  );
                  setUploadedImages(updatedImages);
                  form.setValue(
                    "images",
                    updatedImages.map((img) => img.url)
                  );
                }}
                existingImages={uploadedImages}
                maxFiles={10}
                folder="PropertyPro/maintenance"
                quality="auto"
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Card className="border-0 shadow-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-6 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.history.back();
                  }}
                >
                  {t("maintenance.form.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || submitDisabled}
                  className="h-11 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? t("maintenance.form.buttons.submitting")
                    : submitLabel ||
                      (initialData
                        ? t("maintenance.form.buttons.updateRequest")
                        : t("maintenance.form.buttons.submitRequest"))}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
