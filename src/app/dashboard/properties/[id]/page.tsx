"use client";

import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Bed,
  Bath,
  Square,
  DollarSign,
  MapPin,
  Edit,
  Trash2,
  Camera,
  Eye,
  Building2,
  Star,
  Home,
  CheckCircle,
  Calendar,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { unitService } from "@/lib/services/unit.service";
import { propertyService } from "@/lib/services/property.service";
import { AddUnitDialog } from "@/components/properties/AddUnitDialog";
import PropertyAmenities from "@/components/properties/PropertyAmenities";
import PropertyImageGallery from "@/components/properties/PropertyImageGallery";
import PropertyStatusManager from "@/components/properties/PropertyStatusManager";
import { EnhancedUnitDisplay } from "@/components/properties/UnitDisplay";
import { useLocalization } from "@/hooks/use-localization";
import { createAccessProfile } from "@/lib/permissions-manager";

export default function PropertyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddUnitDialog, setShowAddUnitDialog] = useState(false);
  const { t, formatCurrency, formatNumber, formatDate } = useLocalization();
  const propertyId = params.id as string;

  // Helper function to get unit statistics
  const getUnitStats = (units: any[]) => {
    if (!units || units.length === 0) {
      return { available: 0, occupied: 0, maintenance: 0, total: 0, types: [] };
    }

    const stats = {
      available: 0,
      occupied: 0,
      maintenance: 0,
      total: units.length,
      types: [] as string[],
    };

    const typeSet = new Set<string>();

    units.forEach((unit) => {
      switch (unit.status) {
        case "available":
          stats.available++;
          break;
        case "occupied":
          stats.occupied++;
          break;
        case "maintenance":
          stats.maintenance++;
          break;
      }
      typeSet.add(unit.unitType);
    });

    stats.types = Array.from(typeSet);
    return stats;
  };

  // Helper function to get rent range for multi-unit properties
  const getRentRange = (units: any[]) => {
    if (!units || units.length === 0) return null;

    const rents = units.map((unit: any) => unit.rentAmount);
    const minRent = Math.min(...rents);
    const maxRent = Math.max(...rents);

    if (minRent === maxRent) {
      return `${formatCurrency(minRent)}`;
    }

    return `${formatCurrency(minRent)} - ${formatCurrency(maxRent)}`;
  };

  // Helper function to get total square footage from units
  const getTotalSquareFootage = (units: any[]) => {
    if (units.length > 0) {
      return units.reduce(
        (total, unit) => total + (unit.squareFootage || 0),
        0
      );
    }
    return 0;
  };

  // Helper function to get total bedrooms from units
  const getTotalBedrooms = (units: any[]) => {
    if (units.length > 0) {
      return units.reduce((total, unit) => total + (unit.bedrooms || 0), 0);
    }
    return 0;
  };

  // Helper function to get total bathrooms from units
  const getTotalBathrooms = (units: any[]) => {
    if (units.length > 0) {
      return units.reduce((total, unit) => total + (unit.bathrooms || 0), 0);
    }
    return 0;
  };

  // Helper function to get security deposit range from units
  const getSecurityDepositRange = (units: any[]) => {
    if (!units || units.length === 0) return null;

    const deposits = units.map((unit: any) => unit.securityDeposit || 0);
    const minDeposit = Math.min(...deposits);
    const maxDeposit = Math.max(...deposits);

    if (minDeposit === maxDeposit) {
      return `${formatCurrency(minDeposit)}`;
    }

    return `${formatCurrency(minDeposit)} - ${formatCurrency(maxDeposit)}`;
  };

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);

        const propertyData = await propertyService.getProperty(propertyId);

        if (!propertyData) {
          throw new Error("Property data is null or undefined");
        }

        setProperty(propertyData);

        // Set units from property data for all properties (both single and multi-unit)
        // The API already includes units data, so we don't need to fetch separately
        if (propertyData.units?.length > 0) {
          setUnits(propertyData.units);

          // Ensure totalUnits is in sync with actual units count
          if (propertyData.totalUnits !== propertyData.units.length) {
            setProperty((prev: any) =>
              prev
                ? {
                    ...prev,
                    totalUnits: propertyData.units?.length || 0,
                  }
                : null
            );
          }
        } else {
          setUnits([]);
        }
      } catch (err: any) {
        console.warn("Impossible de charger le détail du bien", err instanceof Error ? err.message : err);
        const errorMessage = t("properties.details.error.fetchFailed");
        toast.error(errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchProperty();
    }
  }, [propertyId, t]);

  // Refresh units data after unit operations
  const refreshUnits = async () => {
    try {
      setUnitsLoading(true);
      const unitsData = await unitService.getUnits(propertyId);
      setUnits(unitsData);

      // Update property's totalUnits to keep it in sync
      if (property) {
        setProperty((prev: any) =>
          prev ? { ...prev, totalUnits: unitsData.length } : null
        );
      }
    } catch (err: any) {
      console.warn("Impossible d’actualiser les logements", err instanceof Error ? err.message : err);
      toast.error(err.message || t("properties.details.units.refreshError"));
    } finally {
      setUnitsLoading(false);
    }
  };

  // Handler for editing property
  const handleEditProperty = () => {
    router.push(`/dashboard/properties/${propertyId}/edit`);
  };

  // Unit management handlers

  // DISABLED: Delete functionality temporarily disabled
  const handleDeleteUnit = async (unitId: string) => {
    try {
      await unitService.deleteUnit(propertyId, unitId);
      toast.success("Logement supprimé avec succès");
      await refreshUnits(); // Refresh units list
    } catch (err: any) {
      toast.error(err.message || "Échec de la suppression du logement");
      throw err; // Re-throw to let the component handle it
    }
  };

  // DISABLED: Delete functionality temporarily disabled
  const handleDeleteProperty = async () => {
    try {
      setIsDeleting(true);
      await propertyService.deleteProperty(propertyId);
      toast.success("Bien supprimé avec succès");
      router.push("/dashboard/properties");
    } catch (err: any) {
      toast.error(err.message || "Échec de la suppression du bien");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Check if user can edit/delete this property - Single company architecture
  const canModifyProperty = () => {
    if (!session?.user || !property) return false;
    const accessProfile = createAccessProfile((session.user as any).role);
    return accessProfile.isCompanyStaff;
  };

  // Show loading skeleton while fetching data
  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <div className="animate-pulse h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded-md" />
            <div className="space-y-2">
              <div className="animate-pulse h-9 w-64 bg-gray-200 dark:bg-gray-800 rounded-md" />
              <div className="flex items-center space-x-2">
                <div className="animate-pulse h-6 w-20 bg-gray-200 dark:bg-gray-800 rounded-md" />
                <div className="animate-pulse h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="animate-pulse h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded-md" />
            <div className="animate-pulse h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-md" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
            <div className="animate-pulse w-full h-96 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6"
              >
                <div className="animate-pulse h-16 bg-gray-200 dark:bg-gray-800 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("properties.details.error.title")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {error}
            </p>
            <div className="flex space-x-3">
              <Button
                size="sm"
                onClick={() => window.location.reload()}
                variant="outline"
              >
                {t("properties.details.actions.retry")}
              </Button>
              <Button
                size="sm"
                onClick={() => router.push("/dashboard/properties")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("properties.details.actions.backToList")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("properties.details.notFound.title")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {t("properties.details.notFound.description")}
            </p>
            <Button
              size="sm"
              onClick={() => router.push("/dashboard/properties")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("properties.details.actions.backToList")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Left side - Back button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/dashboard/properties")}
          className="flex items-center space-x-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("properties.details.actions.backToList")}</span>
        </Button>

        {/* Center - Property name and badges */}
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {property?.name || t("properties.details.unknownProperty")}
          </h1>
          <div className="flex items-center justify-center space-x-2 mt-2">
            {property?.status && (
              <Badge variant="outline">
                {t(`properties.status.${property.status}`)}
              </Badge>
            )}
            {property?.type && (
              <Badge variant="secondary">
                {t(`properties.type.${property.type}`)}
              </Badge>
            )}
          </div>
        </div>

        {/* Right side - Action Buttons */}
        {canModifyProperty() && (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleEditProperty}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>{t("properties.details.actions.editProperty")}</span>
            </Button>

            {/* DISABLED: Delete functionality temporarily disabled */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t("properties.details.actions.deleteProperty")}</span>
            </Button>
          </div>
        )}
      </div>
      {/* Enhanced Property Details Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-2">
          <TabsList className="flex w-full gap-1 overflow-x-auto bg-transparent rounded-lg h-auto pb-1">
            <TabsTrigger
              value="overview"
              className="shrink-0 flex items-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm rounded-lg bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Building2 className="h-4 w-4 text-blue-600 data-[state=active]:text-white" />
              <span className="font-medium text-sm text-gray-700 dark:text-gray-300 data-[state=active]:text-white">
                {t("properties.details.tabs.overview")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className="shrink-0 flex items-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm rounded-lg bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Eye className="h-4 w-4 text-blue-600 data-[state=active]:text-white" />
              <span className="font-medium text-sm text-gray-700 dark:text-gray-300 data-[state=active]:text-white">
                {t("properties.details.tabs.details")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="units"
              className="shrink-0 flex items-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm rounded-lg bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-700 data-[state=active]:to-blue-800 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Building2 className="h-4 w-4 text-blue-600 data-[state=active]:text-white" />
              <span className="font-medium text-sm text-gray-700 dark:text-gray-300 data-[state=active]:text-white">
                {t("properties.details.tabs.units")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="images"
              className="shrink-0 flex items-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm rounded-lg bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-800 data-[state=active]:to-blue-900 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Camera className="h-4 w-4 text-blue-600 data-[state=active]:text-white" />
              <span className="font-medium text-sm text-gray-700 dark:text-gray-300 data-[state=active]:text-white">
                {t("properties.details.tabs.images")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="amenities"
              className="shrink-0 flex items-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm rounded-lg bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-900 data-[state=active]:to-indigo-900 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Star className="h-4 w-4 text-blue-600 data-[state=active]:text-white" />
              <span className="font-medium text-sm text-gray-700 dark:text-gray-300 data-[state=active]:text-white">
                {t("properties.details.tabs.amenities")}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Enhanced Property Basic Information - Minimal Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Property Type */}
            <Card className="border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 hover:shadow-md">
              <CardContent className="">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white capitalize break-words">
                      {property?.type
                        ? t(`properties.type.${property.type}`)
                        : t("properties.labels.unknown")}
                    </p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("properties.details.overview.propertyType")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Units (for multi-unit) or Bedrooms (for single unit) */}
            <Card className="border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 hover:shadow-md">
              <CardContent className="">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Bed className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                      {getTotalBedrooms(units) ||
                        t("properties.labels.unknown")}
                    </p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("properties.details.overview.bedrooms")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bathrooms */}
            <Card className="border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 hover:shadow-md">
              <CardContent className="">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Bath className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                      {getTotalBathrooms(units) ||
                        t("properties.labels.unknown")}
                    </p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("properties.details.overview.bathrooms")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Square Footage */}
            <Card className="border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 hover:shadow-md">
              <CardContent className="">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Square className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                      {(() => {
                        const totalSqFt = getTotalSquareFootage(units);
                        return totalSqFt > 0
                          ? `${formatNumber(totalSqFt)} ${t(
                              "properties.labels.squareFeetUnit"
                            )}`
                          : t("properties.labels.unknown");
                      })()}
                    </p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("properties.details.overview.totalSquareFootage")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Multi-Unit Property Statistics - Minimal Style */}
          {property?.isMultiUnit && units.length > 0 && (
            <Card className="border p-0 border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
              <CardHeader className="bg-blue-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-6">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t("properties.details.overview.occupancy.title")}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {t("properties.details.overview.occupancy.subtitle")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("units")}
                      className="border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {t("properties.details.overview.actions.viewAllUnits")}
                    </Button>
                    {canModifyProperty() && (
                      <Button
                        onClick={() => setShowAddUnitDialog(true)}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        {t("properties.details.overview.actions.addUnit")}
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {(() => {
                  const unitStats = getUnitStats(units);
                  const occupancyRate =
                    unitStats.total > 0
                      ? Math.round((unitStats.occupied / unitStats.total) * 100)
                      : 0;

                  return (
                    <div className="space-y-6">
                      {/* Occupancy Rate */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {t(
                              "properties.details.overview.occupancy.rateLabel"
                            )}
                          </h4>
                          <span className="text-lg sm:text-2xl font-bold text-blue-600">
                            {occupancyRate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full"
                            style={{ width: `${occupancyRate}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t("properties.details.overview.occupancy.summary", {
                            values: {
                              occupied: unitStats.occupied,
                              total: unitStats.total,
                            },
                          })}
                        </p>
                      </div>

                      {/* Unit Status Summary - Minimal Style */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                          <div className="text-3xl font-bold text-green-600 mb-2">
                            {unitStats.available}
                          </div>
                          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {t("properties.status.available")}
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  unitStats.total > 0
                                    ? (unitStats.available / unitStats.total) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {unitStats.occupied}
                          </div>
                          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {t("properties.status.occupied")}
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  unitStats.total > 0
                                    ? (unitStats.occupied / unitStats.total) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                          <div className="text-3xl font-bold text-yellow-600 mb-2">
                            {unitStats.maintenance}
                          </div>
                          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {t("properties.status.maintenance")}
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-yellow-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  unitStats.total > 0
                                    ? (unitStats.maintenance /
                                        unitStats.total) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            {unitStats.total}
                          </div>
                          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {t("properties.details.specs.fields.totalUnits")}
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-gray-500 h-2 rounded-full w-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Enhanced Property Location & Financial Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Property Location Card - Minimal Style */}
            <Card className="border p-0 border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
              <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-6">
                <CardTitle className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {t("properties.details.location.title")}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {t("properties.details.location.subtitle")}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-4  ">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      {t("properties.details.location.street")}
                    </label>
                    <p className="text-md font-semibold text-gray-900 dark:text-white">
                      {property?.address?.street ||
                        t("properties.details.common.notAvailable")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                        {t("properties.details.location.city")}
                      </label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {property?.address?.city ||
                          t("properties.details.common.notAvailable")}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                        {t("properties.details.location.state")}
                      </label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {property?.address?.state ||
                          t("properties.details.common.notAvailable")}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      {t("properties.details.location.postalCode")}
                    </label>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {property?.address?.zipCode ||
                        t("properties.details.common.notAvailable")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Overview - Minimal Style */}
            <Card className="border p-0 border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
              <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-6">
                <CardTitle className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {t("properties.details.financial.title")}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {t("properties.details.financial.subtitle")}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block uppercase tracking-wide">
                        {t("properties.details.financial.monthlyRent.label")}
                      </label>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {property?.isMultiUnit && units.length > 0
                          ? getRentRange(units) ||
                            t("properties.details.common.notAvailable")
                          : getRentRange(units) ||
                            t("properties.details.common.notAvailable")}
                      </p>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        {/* <DollarSign className="h-4 w-4 mr-1" /> */}
                        <span>
                          {t("properties.details.financial.monthlyRent.helper")}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block uppercase tracking-wide">
                          {t(
                            "properties.details.financial.securityDeposit.label"
                          )}
                        </label>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {getSecurityDepositRange(units) ||
                            t("properties.details.common.notAvailable")}
                        </p>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <Square className="h-3 w-3 mr-1" />
                          <span>
                            {t(
                              "properties.details.financial.securityDeposit.helper"
                            )}
                          </span>
                        </div>
                      </div>
                      {/* Prix par m² supprimé */}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Property Specifications - Minimal Style */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Building2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {t("properties.details.specs.title")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {t("properties.details.specs.subtitle")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Property Type Card */}
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {t("properties.details.specs.fields.type")}
                  </label>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                  {property?.type
                    ? t(`properties.type.${property.type}`)
                    : t("properties.details.common.notAvailable")}
                </p>
              </div>

              {/* Status Card */}
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {t("properties.details.specs.fields.status")}
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {property?.status
                      ? t(`properties.status.${property.status}`)
                      : t("properties.details.common.notAvailable")}
                  </p>
                  {canModifyProperty() && (
                    <PropertyStatusManager
                      currentStatus={property?.status}
                      onStatusUpdate={async (newStatus) => {
                        try {
                          await propertyService.updateProperty(propertyId, {
                            status: newStatus,
                          });
                          setProperty((prev: any) =>
                            prev ? { ...prev, status: newStatus } : null
                          );
                          toast.success(
                            t("properties.toasts.statusUpdate.success")
                          );
                        } catch (error: any) {
                          toast.error(
                            error.message ||
                              t("properties.toasts.statusUpdate.error")
                          );
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Total Units Card */}
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {t("properties.details.specs.fields.totalUnits")}
                  </label>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {units.length || 1}
                </p>
              </div>
              
              {/* Property Owner Card */}
{property?.ownerId && (
  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900">
        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>

      <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
        Propriétaire du bien
      </label>
    </div>

    <p className="text-lg font-bold text-gray-900 dark:text-white">
      {property.ownerId.businessName ||
        `${property.ownerId.firstName || ""} ${
          property.ownerId.lastName || ""
        }`.trim()}
    </p>

    {property.ownerId.accountType && (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {property.ownerId.accountType === "direct_owner"
          ? "Propriétaire direct"
          : property.ownerId.accountType === "agency"
            ? "Agence immobilière"
            : property.ownerId.accountType === "e_immo"
              ? "E-IMMO"
              : property.ownerId.accountType}
      </p>
    )}
  </div>
)}

              {/* Year Built Card */}
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900">
                    <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {t("properties.details.specs.fields.yearBuilt")}
                  </label>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {property?.yearBuilt ||
                    t("properties.details.common.notAvailable")}
                </p>
              </div>

              {/* Description Card - Full Width */}
              {property?.description && (
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900">
                      <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      {t("properties.details.specs.fields.description")}
                    </label>
                  </div>
                  <p className="text-base text-gray-700 dark:text-gray-300">
                    {property.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Property Features */}
          {property?.features?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900">
                  <Star className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                    {t("properties.details.features.title")}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t("properties.details.features.subtitle")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {property.features.map((feature: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm"
                  >
                    <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Property Amenities */}
          {property?.amenities?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Building2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                    {t("properties.details.amenities.title")}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t("properties.details.amenities.subtitle")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {property.amenities.map((amenity: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm"
                  >
                    <div className="flex-shrink-0 w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {amenity.name || amenity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="images" className="space-y-6">
          <PropertyImageGallery
            images={property?.images || []}
            propertyName={
              property?.name || t("properties.details.unknownProperty")
            }
            canEdit={canModifyProperty()}
            onImagesUpdate={(newImages) => {
              setProperty((prev: any) =>
                prev ? { ...prev, images: newImages } : null
              );
            }}
            propertyId={propertyId}
          />
        </TabsContent>

        <TabsContent value="amenities" className="space-y-6">
          <PropertyAmenities
            amenities={property.amenities}
            canEdit={canModifyProperty()}
            onAmenitiesUpdate={(newAmenities) => {
              setProperty((prev: any) =>
                prev ? { ...prev, amenities: newAmenities } : null
              );
            }}
            propertyId={propertyId}
          />
        </TabsContent>

        {/* Units Tab - For all properties */}
        <TabsContent value="units" className="space-y-6">
          <EnhancedUnitDisplay
            units={units}
            propertyId={propertyId}
            // onDeleteUnit={handleDeleteUnit}
            onAddUnit={() => {
              // Open add unit dialog
              setShowAddUnitDialog(true);
            }}
            onUnitsChange={refreshUnits}
            isLoading={unitsLoading}
          />
        </TabsContent>
      </Tabs>

      {/* DISABLED: Delete functionality temporarily disabled */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le bien</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{property?.name}&quot;? This
              action cannot be undone. All associated data including leases,
              payments, and maintenance requests will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Suppression..." : "Supprimer le bien"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddUnitDialog
        open={showAddUnitDialog}
        onOpenChange={setShowAddUnitDialog}
        propertyId={propertyId}
        onUnitAdded={refreshUnits}
      />
    </div>
  );
}
