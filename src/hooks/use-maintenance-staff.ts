/**
 * PropertyPro - Maintenance Staff Hook
 * Hook for fetching available maintenance staff for assignment
 */

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAuthorization } from "./useAuthorization";
import { E_IMMO_MAINTENANCE_EMAIL } from "@/lib/default-maintenance-staff";

interface MaintenanceStaff {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface UseMaintenanceStaffReturn {
  staff: MaintenanceStaff[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMaintenanceStaff(): UseMaintenanceStaffReturn {
  const { data: session } = useSession();
  const { isAdmin } = useAuthorization();
  const [staff, setStaff] = useState<MaintenanceStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFetchStaff = isAdmin;

  const fetchStaff = async () => {
    // Don't fetch if user doesn't have permission
    if (!canFetchStaff) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/maintenance/staff?isActive=true", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Échec du chargement des techniciens");
      }

      const data = await response.json();
      const staffList = data.data?.staff || data.staff || [];

      const filteredStaff = staffList.filter(
        (user: MaintenanceStaff) =>
          user.isActive && user.email?.toLowerCase() !== E_IMMO_MAINTENANCE_EMAIL
      );

      setStaff(filteredStaff);
    } catch (err) {
      console.warn("Chargement des techniciens indisponible :", err);
      setError(err instanceof Error ? err.message : "Échec du chargement des techniciens");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session && canFetchStaff) {
      fetchStaff();
    } else if (session && !canFetchStaff) {
      // For users without permission, set loading to false immediately
      setIsLoading(false);
    }
  }, [session, canFetchStaff]);

  return {
    staff,
    isLoading,
    error,
    refetch: fetchStaff,
  };
}
