/**
 * PropertyPro - Tenant Dashboard API Tests
 * Test suite for the tenant dashboard API endpoint
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { Lease, Payment, MaintenanceRequest } from "@/models";
import { ensureTenantProfile } from "@/lib/tenant-utils";
import { UserRole, LeaseStatus, PaymentStatus } from "@/types";

// Mock dependencies
jest.mock("@/lib/auth");
jest.mock("@/lib/mongodb");
jest.mock("@/models");
jest.mock("@/lib/tenant-utils");

const mockSession = {
  user: {
    id: "user123",
    email: "tenant@example.com",
    role: UserRole.TENANT,
  },
};

const mockTenant = {
  _id: "tenant123",
  userId: "user123",
};

const mockLeases = [
  {
    _id: "lease123",
    tenantId: "tenant123",
    propertyId: {
      _id: "property123",
      name: "Test Property",
      address: "123 Test St",
      type: "apartment",
    },
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    status: LeaseStatus.ACTIVE,
    terms: {
      rentAmount: 1500,
    },
    toObject: () => ({
      _id: "lease123",
      tenantId: "tenant123",
      propertyId: {
        _id: "property123",
        name: "Test Property",
        address: "123 Test St",
        type: "apartment",
      },
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      status: LeaseStatus.ACTIVE,
      terms: {
        rentAmount: 1500,
      },
    }),
  },
  {
    _id: "lease456",
    tenantId: "tenant123",
    propertyId: {
      _id: "property456",
      name: "Another Property",
      address: "456 Another St",
      type: "house",
    },
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-12-31"),
    status: LeaseStatus.EXPIRED,
    terms: {
      rentAmount: 1200,
    },
    toObject: () => ({
      _id: "lease456",
      tenantId: "tenant123",
      propertyId: {
        _id: "property456",
        name: "Another Property",
        address: "456 Another St",
        type: "house",
      },
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      status: LeaseStatus.EXPIRED,
      terms: {
        rentAmount: 1200,
      },
    }),
  },
];

const mockPayments = [
  {
    _id: "payment123",
    tenantId: "tenant123",
    amount: 1500,
    dueDate: new Date("2024-01-01"),
    paidDate: new Date("2024-01-01"),
    status: PaymentStatus.PAID,
    type: "rent",
    createdAt: new Date("2023-12-01"),
  },
];

const mockMaintenanceRequests = [
  {
    _id: "maintenance123",
    tenantId: "tenant123",
    title: "Leaky Faucet",
    description: "Kitchen faucet is leaking",
    priority: "medium",
    status: "open",
    createdAt: new Date("2024-01-15"),
    assignedTo: null,
  },
];

describe("/api/tenant/dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (auth as jest.Mock).mockResolvedValue(mockSession);
    (connectDB as jest.Mock).mockResolvedValue(undefined);

    (ensureTenantProfile as jest.Mock).mockResolvedValue(mockTenant);

    // Mock Lease.find
    (Lease.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockLeases),
      }),
    });

    // Mock Payment.find
    (Payment.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockPayments),
      }),
    });

    // Mock MaintenanceRequest.find
    (MaintenanceRequest.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockMaintenanceRequests),
        }),
      }),
    });
  });

  it("should return dashboard data for authenticated tenant", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty(UserRole.TENANT);
    expect(data.data).toHaveProperty("currentLease");
    expect(data.data).toHaveProperty("allLeases");
    expect(data.data).toHaveProperty("hasMultipleLeases");
    expect(data.data).toHaveProperty("recentPayments");
    expect(data.data).toHaveProperty("upcomingPayments");
    expect(data.data).toHaveProperty("maintenanceRequests");
    expect(data.data).toHaveProperty("notifications");
    expect(data.data).toHaveProperty("summary");
  });

  it("should return 401 for unauthenticated requests", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Authentication required");
  });

  it("should return 403 for non-tenant users", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: {
        id: "user123",
        email: "admin@example.com",
        role: UserRole.ADMIN,
      },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe("This endpoint is for tenants only");
  });

  it("should return 500 when tenant profile cannot be resolved", async () => {
    (ensureTenantProfile as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Tenant profile unavailable");
  });

  it("should correctly identify multiple leases", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.hasMultipleLeases).toBe(true);
    expect(data.data.allLeases).toHaveLength(2);
    expect(data.data.summary.totalLeases).toBe(2);
    expect(data.data.summary.activeLeases).toBe(1);
    expect(data.data.summary.expiredLeases).toBe(1);
  });

  it("should calculate lease expiration days correctly", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    const activeLease = data.data.allLeases.find(
      (lease: any) => lease.isActive
    );
    expect(activeLease).toHaveProperty("daysUntilExpiration");
    expect(typeof activeLease.daysUntilExpiration).toBe("number");

    const expiredLease = data.data.allLeases.find(
      (lease: any) => lease.isExpired
    );
    expect(expiredLease).toHaveProperty("daysUntilExpiration");
    expect(expiredLease.daysUntilExpiration).toBeLessThan(0);
  });

  it("should handle database errors gracefully", async () => {
    (connectDB as jest.Mock).mockRejectedValue(
      new Error("Database connection failed")
    );

    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to fetch tenant dashboard data");
  });

  it("should return correct summary statistics", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary).toEqual({
      totalLeases: 2,
      activeLeases: 1,
      upcomingLeases: 0,
      expiredLeases: 1,
      totalPayments: 1,
      paidPayments: 1,
      overduePayments: 0,
      openMaintenanceRequests: 1,
      unreadNotifications: 2, // Mock notifications in the API
    });
  });

  it("should select active lease as current lease", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.currentLease).toBeTruthy();
    expect(data.data.currentLease.isActive).toBe(true);
    expect(data.data.currentLease._id).toBe("lease123");
  });

  it("should handle tenant with no leases", async () => {
    (Lease.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/tenant/dashboard"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.allLeases).toHaveLength(0);
    expect(data.data.hasMultipleLeases).toBe(false);
    expect(data.data.currentLease).toBeNull();
    expect(data.data.summary.totalLeases).toBe(0);
  });
});
