/**
 * PropertyPro - Lease Service
 * Comprehensive service for lease management with CRUD operations and lifecycle methods
 */

import { ILease, LeaseStatus } from "@/types";

export interface LeaseQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeaseStatus;
  propertyId?: string;
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** When true, return only archived leases; otherwise archived are excluded. */
  archived?: boolean;
}

export interface LeaseFormData {
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  status?: LeaseStatus;
  terms: {
    rentAmount: number;
    securityDeposit: number;
    lateFee: number;
    petDeposit?: number;
    utilities: string[];
    restrictions: string[];
  };
  documents?: string[];
  renewalOptions?: {
    available: boolean;
    terms?: string;
  };
  notes?: string;
}

export interface LeaseResponse {
  _id: string;
  propertyId: {
    _id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    type: string;
    ownerId?: { _id: string; firstName?: string; lastName?: string; businessName?: string; accountType?: string; email?: string; phone?: string };
    managerId?: { _id: string; firstName?: string; lastName?: string; businessName?: string; accountType?: string; email?: string; phone?: string };
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
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
  };
  unitId: string;
  unit?: {
    _id: string;
    unitNumber: string;
    unitType: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    rentAmount: number;
    securityDeposit: number;
    status: string;
  };
  tenantId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    dateOfBirth?: string;
    employmentInfo?: {
      employer: string;
      position: string;
      income: number;
      startDate: string;
    };
    emergencyContacts?: Array<{
      name: string;
      relationship: string;
      phone: string;
      email?: string;
    }>;
    creditScore?: number;
    backgroundCheckStatus?: "pending" | "approved" | "rejected";
    moveInDate?: string;
    moveOutDate?: string;
    applicationDate?: string;
    tenantStatus?: string;
  };
  startDate: string;
  endDate: string;
  status: LeaseStatus;
  terms: {
    rentAmount: number;
    securityDeposit: number;
    lateFee: number;
    petDeposit?: number;
    utilities: string[];
    restrictions: string[];
  };
  documents: string[];
  signedDate?: string;
  renewalOptions?: {
    available: boolean;
    terms?: string;
  };
  notes?: string;
  contractText?: string;
  contractVersion?: number;
  contractValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface PaginatedLeasesResponse {
  data: LeaseResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface LeaseSignatureData {
  signatureData: string;
  ipAddress?: string;
}

export interface LeaseTerminationData {
  terminationDate: string;
  reason: string;
  notice?: string;
  moveOutInspection?: boolean;
}

export interface LeaseRenewalData {
  newStartDate: string;
  newEndDate: string;
  newTerms?: Partial<LeaseFormData["terms"]>;
  renewalType?: "automatic" | "manual";
  notes?: string;
}

class LeaseService {
  private baseUrl = "/api/leases";

  /**
   * Get all leases with pagination and filtering
   */
  async getLeases(params?: LeaseQueryParams): Promise<PaginatedLeasesResponse> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, value.toString());
        }
      });
    }

    const url = `${this.baseUrl}${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to fetch leases");
    }

    return response.json();
  }

  /**
   * Get active leases with enhanced information
   */
  async getActiveLeases(
    params?: Omit<LeaseQueryParams, "status">
  ): Promise<PaginatedLeasesResponse> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, value.toString());
        }
      });
    }

    const url = `${this.baseUrl}/active${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to fetch active leases"
      );
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * Get a specific lease by ID
   */
  async getLeaseById(id: string): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to fetch lease");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Create a new lease
   */
  async createLease(data: LeaseFormData): Promise<LeaseResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to create lease");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Update an existing lease
   */
  async updateLease(
    id: string,
    data: Partial<LeaseFormData>
  ): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to update lease");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Delete a lease (soft delete)
   */
  async deleteLease(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to delete lease");
    }
  }

  /**
   * Sign a lease
   */
  async signLease(
    id: string,
    signatureData: LeaseSignatureData
  ): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/sign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(signatureData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to sign lease");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Terminate a lease
   */
  async terminateLease(
    id: string,
    terminationData: LeaseTerminationData
  ): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/terminate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ...terminationData,
        terminationDate: new Date(terminationData.terminationDate),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to terminate lease"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Renew a lease
   */
  async renewLease(
    id: string,
    renewalData: LeaseRenewalData
  ): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/renew`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ...renewalData,
        newStartDate: new Date(renewalData.newStartDate),
        newEndDate: new Date(renewalData.newEndDate),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to renew lease");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Change lease status
   */
  async changeLeaseStatus(
    id: string,
    status: LeaseStatus,
    additionalData?: any
  ): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        action: "changeStatus",
        status,
        ...additionalData,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to change lease status"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Archive a terminated/expired lease (keeps all records, hides from default list)
   */
  async archiveLease(id: string): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ action: "archive" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to archive lease"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Restore an archived lease back to the active list
   */
  async unarchiveLease(id: string): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ action: "unarchive" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to restore lease"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Upload documents for a lease
   */
  async uploadDocuments(
    id: string,
    files: File[],
    options?: {
      type?: string;
      category?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<any> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    if (options?.type) formData.append("type", options.type);
    if (options?.category) formData.append("category", options.category);
    if (options?.description)
      formData.append("description", options.description);
    if (options?.tags) formData.append("tags", options.tags.join(","));

    const response = await fetch(`${this.baseUrl}/${id}/documents/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to upload documents"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get documents for a lease
   */
  async getLeaseDocuments(
    id: string,
    params?: {
      page?: number;
      limit?: number;
      type?: string;
      category?: string;
      search?: string;
    }
  ): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.type) searchParams.append("type", params.type);
    if (params?.category) searchParams.append("category", params.category);
    if (params?.search) searchParams.append("search", params.search);

    const response = await fetch(
      `${this.baseUrl}/${id}/documents?${searchParams.toString()}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to get lease documents"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Delete a document from a lease
   */
  async deleteDocument(id: string, documentId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/${id}/documents/${documentId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to delete document"
      );
    }
  }

  /**
   * Bulk delete leases
   */
  async bulkDeleteLeases(leaseIds: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}?ids=${leaseIds.join(",")}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to delete leases"
      );
    }
  }

  /**
   * Get lease statistics
   */
  async getLeaseStats(): Promise<{
    total: number;
    active: number;
    draft: number;
    pending: number;
    expired: number;
    terminated: number;
    expiringThisMonth: number;
  }> {
    const response = await fetch(`${this.baseUrl}/stats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to fetch lease stats"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get available units for a property from the unified property-unit model
   */
  async getAvailableUnits(propertyId: string): Promise<
    Array<{
      _id: string;
      unitNumber: string;
      unitType: string;
      bedrooms: number;
      bathrooms: number;
      squareFootage: number;
      rentAmount: number;
      securityDeposit: number;
      status: string;
      floor?: number;
      balcony?: boolean;
      patio?: boolean;
      garden?: boolean;
      appliances?: any;
      parking?: any;
      utilities?: any;
    }>
  > {
    const response = await fetch(
      `/api/properties/${propertyId}/units/available`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to fetch available units"
      );
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Get leases expiring soon
   */
  async getExpiringLeases(days: number = 30): Promise<LeaseResponse[]> {
    const response = await fetch(`${this.baseUrl}/expiring?days=${days}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to fetch expiring leases"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Add document to lease
   */
  async addDocument(id: string, documentUrl: string): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ documentUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to add document");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Remove document from lease
   */
  async removeDocument(
    id: string,
    documentUrl: string
  ): Promise<LeaseResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/documents`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ documentUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to remove document"
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Utility method to format lease duration
   */
  formatLeaseDuration(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.round(diffDays / 30);

    if (diffMonths < 1) {
      return `${diffDays} days`;
    } else if (diffMonths === 1) {
      return "1 month";
    } else if (diffMonths < 12) {
      return `${diffMonths} months`;
    } else {
      const years = Math.floor(diffMonths / 12);
      const remainingMonths = diffMonths % 12;
      if (remainingMonths === 0) {
        return years === 1 ? "1 year" : `${years} years`;
      } else {
        return `${years} year${years > 1 ? "s" : ""} ${remainingMonths} month${
          remainingMonths > 1 ? "s" : ""
        }`;
      }
    }
  }

  /**
   * Utility method to calculate days remaining
   */
  getDaysRemaining(endDate: string): number {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Utility method to check if lease is expiring soon
   */
  isExpiringSoon(endDate: string, days: number = 30): boolean {
    return (
      this.getDaysRemaining(endDate) <= days &&
      this.getDaysRemaining(endDate) > 0
    );
  }

  /**
   * Utility method to get lease status color
   */
  getStatusColor(status: LeaseStatus): string {
    switch (status) {
      case LeaseStatus.DRAFT:
        return "outline";
      case LeaseStatus.PENDING:
        return "default";
      case LeaseStatus.ACTIVE:
        return "secondary";
      case LeaseStatus.EXPIRED:
        return "destructive";
      case LeaseStatus.TERMINATED:
        return "destructive";
      default:
        return "outline";
    }
  }
}

export const leaseService = new LeaseService();
