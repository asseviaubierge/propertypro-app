/**
 * PropertyPro - Display Settings API Tests
 * Integration tests for display settings API endpoints
 */

import { NextRequest } from "next/server";
import { GET, PATCH, POST } from "../route";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { Settings } from "@/models";

// Mock dependencies
jest.mock("@/lib/auth");
jest.mock("@/lib/mongodb");
jest.mock("@/models");

const mockSession = {
  user: {
    id: "507f1f77bcf86cd799439011",
    email: "test@example.com",
    role: "USER",
  },
};

const mockSettings = {
  theme: "system",
  currency: "USD",
  branding: {
    logoLight: "/images/logo-light.png",
    logoDark: "/images/logo-dark.png",
    favicon: "/favicon.ico",
    primaryColor: "#3B82F6",
    secondaryColor: "#64748B",
  },
};

const mockUserSettings = {
  display: mockSettings,
  updatedAt: new Date(),
  version: 1,
  updateDisplay: jest.fn(),
};

describe("/api/settings/display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue(mockSession);
    (connectDB as jest.Mock).mockResolvedValue(undefined);
    (Settings.findByUserId as jest.Mock).mockResolvedValue(mockUserSettings);
  });

  describe("GET /api/settings/display", () => {
    it("returns display settings successfully", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/display"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.settings).toEqual(mockSettings);
      expect(data.data.metadata).toBeDefined();
    });

    it("includes defaults when requested", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/display?includeDefaults=true"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.defaults).toBeDefined();
      expect(data.data.isDefault).toBeDefined();
    });

    it("returns export format when requested", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/display?format=export"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.version).toBe("1.0");
      expect(data.data.timestamp).toBeDefined();
      expect(data.data.metadata.exportedBy).toBe(mockSession.user.id);
    });

    it("returns 401 when not authenticated", async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display"
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("returns 404 when settings not found", async () => {
      (Settings.findByUserId as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display"
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/settings/display", () => {
    it("updates display settings partially", async () => {
      const updateData = {
        theme: "dark",
        currency: "EUR",
      };

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "PATCH",
          body: JSON.stringify(updateData),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUserSettings.updateDisplay).toHaveBeenCalled();
      expect(data.data.updatedFields).toEqual(["theme", "currency"]);
    });

    it("validates partial update data", async () => {
      const invalidData = {
        theme: "invalid-theme",
        currency: "", // invalid empty currency
      };

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "PATCH",
          body: JSON.stringify(invalidData),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });

    it("merges with existing settings correctly", async () => {
      const updateData = {
        branding: {
          primaryColor: "#ff0000",
        },
      };

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "PATCH",
          body: JSON.stringify(updateData),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(200);
      expect(mockUserSettings.updateDisplay).toHaveBeenCalledWith(
        expect.objectContaining({
          branding: expect.objectContaining({
            primaryColor: "#ff0000",
            logoLight: "/images/logo-light.png", // preserved
            logoDark: "/images/logo-dark.png", // preserved
          }),
        })
      );
    });

    it("returns 401 when not authenticated", async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "PATCH",
          body: JSON.stringify({ theme: "dark" }),
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/settings/display", () => {
    it("resets settings to defaults", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "POST",
          body: JSON.stringify({ action: "reset" }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("reset to defaults");
      expect(mockUserSettings.updateDisplay).toHaveBeenCalled();
    });

    it("handles bulk operations", async () => {
      const bulkData = {
        action: "bulk",
        operations: [
          { field: "theme", value: "dark", operation: "set" },
          {
            field: "branding.primaryColor",
            value: "#ff0000",
            operation: "set",
          },
          { field: "currency", value: "EUR", operation: "set" },
        ],
      };

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "POST",
          body: JSON.stringify(bulkData),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.operationsApplied).toBe(3);
      expect(mockUserSettings.updateDisplay).toHaveBeenCalled();
    });

    it("validates bulk operations", async () => {
      const invalidBulkData = {
        action: "bulk",
        operations: [
          { field: "theme", value: "invalid-theme", operation: "set" },
        ],
      };

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "POST",
          body: JSON.stringify(invalidBulkData),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid action", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "POST",
          body: JSON.stringify({ action: "invalid-action" }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "POST",
          body: JSON.stringify({ action: "reset" }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Error Handling", () => {
    it("handles database connection errors", async () => {
      (connectDB as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("handles invalid JSON in request body", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "PATCH",
          body: "invalid-json",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });

    it("handles settings update errors", async () => {
      mockUserSettings.updateDisplay.mockRejectedValue(
        new Error("Update failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/settings/display",
        {
          method: "PATCH",
          body: JSON.stringify({ theme: "dark" }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(500);
    });
  });
});
