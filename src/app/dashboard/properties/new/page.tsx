"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft } from "lucide-react";
import { EnhancedPropertyForm } from "@/components/properties/PropertyForm";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  showErrorToast,
  showSimpleError,
  showSimpleSuccess,
  parseValidationErrors,
} from "@/lib/toast-notifications";

export default function EnhancedNewPropertyPage() {
  const router = useRouter();
  const { t } = useLocalizationContext();
  const [isLoading, setIsLoading] = useState(false);

  const handlePropertySubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Extract detailed error information from various possible response formats
        const errorDetails = result.details || result.error || result.message;
        const errorMessage =
          typeof errorDetails === "string"
            ? errorDetails
            : Array.isArray(errorDetails)
            ? errorDetails.join(", ")
            : JSON.stringify(errorDetails);

        throw new Error(errorMessage || "Impossible de créer le bien");
      }

      // The API returns data in result.data
      const property = result.data;
      showSimpleSuccess(
        t("properties.newProperty.success.title"),
        t("properties.newProperty.success.description", {
          values: { name: data.name },
        })
      );

      // Redirect to property details page
      router.replace(`/dashboard/properties/${property._id}`);
      router.refresh();
    } catch (error) {
      console.warn(
        "Création du bien interrompue :",
        error instanceof Error ? error.message : String(error)
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : t("properties.newProperty.error.fallbackMessage");

      // Parse validation errors for better display
      const parsedErrors = parseValidationErrors(errorMessage);

      // If we have multiple errors or errors with field info, show detailed toast
      if (parsedErrors.length > 1 || parsedErrors.some((e) => e.field)) {
        showErrorToast({
          title: t("properties.newProperty.error.title"),
          description: `${parsedErrors.length} erreur${parsedErrors.length > 1 ? "s" : ""} de validation détectée${parsedErrors.length > 1 ? "s" : ""}`,
          items: parsedErrors,
        });
      } else {
        // For single simple errors, show a simple error toast
        showSimpleError(
          t("properties.newProperty.error.title"),
          errorMessage
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4 px-3 py-4 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:gap-3 sm:text-3xl">
              <Building2 className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
              {t("properties.newProperty.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("properties.newProperty.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center rounded-lg border sm:w-auto">
          <Link href="/dashboard/properties">
            <Button variant="ghost" size="sm" className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("properties.newProperty.backToList")}
            </Button>
          </Link>
        </div>
      </div>
      <EnhancedPropertyForm
        onSubmit={handlePropertySubmit}
        isLoading={isLoading}
        mode="create"
      />
    </div>
  );
}
