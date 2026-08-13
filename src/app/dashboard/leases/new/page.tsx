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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
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
          className="w-full justify-center gap-2 whitespace-nowrap sm:w-auto"
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
