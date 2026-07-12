"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { propertyService } from "@/lib/services/property.service";
import {
  showSimpleError,
  showSimpleSuccess,
  showErrorToast,
  parseValidationErrors,
} from "@/lib/toast-notifications";
import { EnhancedPropertyForm } from "@/components/properties/PropertyForm";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<any>(null);

  const propertyId = params.id as string;

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await propertyService.getProperty(propertyId);
        setPropertyData(data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch property details");
        showSimpleError("Load Error", err.message || "Failed to fetch property details");
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchProperty();
    }
  }, [propertyId]);

  const handlePropertySubmit = async (data: any) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Failed to update property"
        );
      }

      showSimpleSuccess("Property Updated", "Property updated successfully!");
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update property. Please try again.";
      setError(errorMessage);

      // Parse validation errors for better display
      const parsedErrors = parseValidationErrors(errorMessage);

      if (parsedErrors.length > 1 || parsedErrors.some((e) => e.field)) {
        showErrorToast({
          title: "Update Failed",
          description: `${parsedErrors.length} validation ${
            parsedErrors.length === 1 ? "error" : "errors"
          } found`,
          items: parsedErrors,
        });
      } else {
        showSimpleError("Update Failed", errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Property
            </h3>
            <p className="text-gray-600 text-center mb-6">{error}</p>
            <Button onClick={() => router.push("/dashboard/properties")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            Edit Property
          </h1>
          <p className="text-muted-foreground">
            Update property information and integrated unit management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/properties/${propertyId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Property
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-6">
          <EnhancedPropertyForm
            initialData={propertyData}
            onSubmit={handlePropertySubmit}
            isLoading={saving}
            mode="edit"
            propertyId={propertyId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
