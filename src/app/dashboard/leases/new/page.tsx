"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import SimplifiedLeaseCreation from "@/components/lease/SimplifiedLeaseCreation";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

export default function NewLeasePage() {
  const router = useRouter();
  const { t } = useLocalizationContext();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("leases.new.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("leases.new.header.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("leases.new.header.backButton")}
        </Button>
      </div>

      {/* Simplified Lease Creation Form */}
      <SimplifiedLeaseCreation />
    </div>
  );
}
