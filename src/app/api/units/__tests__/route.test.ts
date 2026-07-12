import { NextRequest } from "next/server";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { Property } from "@/models";

jest.mock("@/lib/auth");
jest.mock("@/lib/mongodb");
jest.mock("@/models", () => ({ Property: { aggregate: jest.fn() } }));

const session = { user: { id: "u1", email: "a@b.com", role: "admin" } };

describe("/api/units", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue(session);
    (connectDB as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns paginated units", async () => {
    (Property.aggregate as jest.Mock)
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        {
          _id: "p1",
          name: "Prop 1",
          type: "apartment",
          address: {
            street: "s",
            city: "c",
            state: "st",
            zipCode: "z",
            country: "US",
          },
          images: [],
          unitId: "u1",
          unitNumber: "101",
          unitType: "apartment",
          bedrooms: 2,
          bathrooms: 1,
          squareFootage: 800,
          rentAmount: 1200,
          unitStatus: "available",
        },
      ]);

    const req = new NextRequest(
      "http://localhost:3000/api/units?page=1&limit=12"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.pagination.total).toBe(2);
  });

  it("requires auth", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/units");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
