"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { PropertyStatus } from "@/types";

// Unit form schema
const unitEditSchema = z.object({
  unitNumber: z.string().min(1, "Unit number is required").max(20),
  unitType: z.enum(["apartment", "studio", "penthouse", "loft", "room"]),
  floor: z.number().min(0).max(200).optional(),
  bedrooms: z.number().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  squareFootage: z.number().min(50).max(50000),
  rentAmount: z.number().min(0).max(100000),
  securityDeposit: z.number().min(0).max(50000),
  status: z.nativeEnum(PropertyStatus),
  balcony: z.boolean().optional(),
  patio: z.boolean().optional(),
  garden: z.boolean().optional(),
  fireplace: z.boolean().optional(),
  walkInCloset: z.boolean().optional(),
  notes: z.string().optional(),
});

type UnitEditFormData = z.infer<typeof unitEditSchema>;

interface UnitEditPageProps {
  params: {
    id: string;
    unitId: string;
  };
}

export default function UnitEditPage({ params }: UnitEditPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [unit, setUnit] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);

  const form = useForm<UnitEditFormData>({
    resolver: zodResolver(unitEditSchema),
    defaultValues: {
      unitNumber: "",
      unitType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      squareFootage: 500,
      rentAmount: 1000,
      securityDeposit: 1000,
      status: PropertyStatus.AVAILABLE,
      balcony: false,
      patio: false,
      garden: false,
      fireplace: false,
      walkInCloset: false,
      notes: "",
    },
  });

  // Load unit and property data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load property data
        const propertyResponse = await fetch(`/api/properties/${params.id}`);
        if (!propertyResponse.ok) {
          throw new Error("Failed to load property");
        }
        const propertyData = await propertyResponse.json();
        setProperty(propertyData.data);

        // Load unit data
        const unitResponse = await fetch(
          `/api/properties/${params.id}/units/${params.unitId}`
        );
        if (!unitResponse.ok) {
          throw new Error("Failed to load unit");
        }
        const unitData = await unitResponse.json();
        setUnit(unitData.data);

        // Set form values
        form.reset({
          unitNumber: unitData.data.unitNumber,
          unitType: unitData.data.unitType,
          floor: unitData.data.floor,
          bedrooms: unitData.data.bedrooms,
          bathrooms: unitData.data.bathrooms,
          squareFootage: unitData.data.squareFootage,
          rentAmount: unitData.data.rentAmount,
          securityDeposit: unitData.data.securityDeposit,
          status: unitData.data.status,
          balcony: unitData.data.balcony || false,
          patio: unitData.data.patio || false,
          garden: unitData.data.garden || false,
          fireplace: unitData.data.fireplace || false,
          walkInCloset: unitData.data.walkInCloset || false,
          notes: unitData.data.notes || "",
        });
      } catch (error: any) {
        toast.error(error.message || "Failed to load unit data");
        router.push(`/dashboard/properties/${params.id}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [params.id, params.unitId, form, router]);

  const onSubmit = async (data: UnitEditFormData) => {
    try {
      setIsSaving(true);

      const response = await fetch(
        `/api/properties/${params.id}/units/${params.unitId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update unit");
      }

      toast.success("Unit updated successfully");
      router.push(`/dashboard/properties/${params.id}?tab=units`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update unit");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/dashboard/properties/${params.id}?tab=units`)
          }
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Property
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Unit {unit?.unitNumber}</h1>
          <p className="text-gray-600">
            {property?.name} - Update unit details
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update the basic details of this unit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unitNumber">Unit Number *</Label>
                  <Input
                    id="unitNumber"
                    {...form.register("unitNumber")}
                    placeholder="e.g., 101, A1"
                  />
                  {form.formState.errors.unitNumber && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.unitNumber.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitType">Unit Type *</Label>
                  <Select
                    value={form.watch("unitType")}
                    onValueChange={(value) =>
                      form.setValue("unitType", value as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                      <SelectItem value="penthouse">Penthouse</SelectItem>
                      <SelectItem value="loft">Loft</SelectItem>
                      <SelectItem value="room">Room</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  type="number"
                  min="0"
                  max="200"
                  {...form.register("floor", { valueAsNumber: true })}
                  placeholder="e.g., 1, 2, 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as PropertyStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PropertyStatus).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Unit Details */}
          <Card>
            <CardHeader>
              <CardTitle>Unit Details</CardTitle>
              <CardDescription>
                Configure the physical characteristics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Bedrooms *</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min="0"
                    max="20"
                    {...form.register("bedrooms", { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Bathrooms *</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    {...form.register("bathrooms", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="squareFootage">Square Footage *</Label>
                <Input
                  id="squareFootage"
                  type="number"
                  min="50"
                  max="50000"
                  {...form.register("squareFootage", { valueAsNumber: true })}
                />
                {form.formState.errors.squareFootage && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.squareFootage.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
            <CardDescription>
              Set the rental and deposit amounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rentAmount">Monthly Rent ($) *</Label>
                <Input
                  id="rentAmount"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  {...form.register("rentAmount", { valueAsNumber: true })}
                />
                {form.formState.errors.rentAmount && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.rentAmount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="securityDeposit">Security Deposit ($) *</Label>
                <Input
                  id="securityDeposit"
                  type="number"
                  min="0"
                  max="50000"
                  step="0.01"
                  {...form.register("securityDeposit", { valueAsNumber: true })}
                />
                {form.formState.errors.securityDeposit && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.securityDeposit.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unit Features */}
        <Card>
          <CardHeader>
            <CardTitle>Unit Features</CardTitle>
            <CardDescription>
              Select the features available in this unit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="balcony"
                  checked={form.watch("balcony")}
                  onCheckedChange={(checked) =>
                    form.setValue("balcony", checked as boolean)
                  }
                />
                <Label htmlFor="balcony">Balcony</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="patio"
                  checked={form.watch("patio")}
                  onCheckedChange={(checked) =>
                    form.setValue("patio", checked as boolean)
                  }
                />
                <Label htmlFor="patio">Patio</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="garden"
                  checked={form.watch("garden")}
                  onCheckedChange={(checked) =>
                    form.setValue("garden", checked as boolean)
                  }
                />
                <Label htmlFor="garden">Garden</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fireplace"
                  checked={form.watch("fireplace")}
                  onCheckedChange={(checked) =>
                    form.setValue("fireplace", checked as boolean)
                  }
                />
                <Label htmlFor="fireplace">Fireplace</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="walkInCloset"
                  checked={form.watch("walkInCloset")}
                  onCheckedChange={(checked) =>
                    form.setValue("walkInCloset", checked as boolean)
                  }
                />
                <Label htmlFor="walkInCloset">Walk-in Closet</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
            <CardDescription>
              Add any additional information about this unit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...form.register("notes")}
              placeholder="Enter any additional notes about this unit..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/properties/${params.id}?tab=units`)
            }
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
