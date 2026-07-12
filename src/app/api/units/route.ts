export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Property } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
} from "@/lib/api-utils";
import { PropertyStatus, PropertyType } from "@/types";

export const GET = withPermissionAndDB("property_view")(
  async (_user: unknown, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paginationParams = parsePaginationParams(searchParams);
      const page = paginationParams.page ?? 1;
      const limit = paginationParams.limit ?? 12;
      const { sortBy, sortOrder, search } = paginationParams;

      const status = searchParams.get("status") || undefined;
      const unitType = searchParams.get("unitType") || undefined;
      const bedrooms = searchParams.get("bedrooms")
        ? parseInt(searchParams.get("bedrooms") as string)
        : undefined;
      const bathrooms = searchParams.get("bathrooms")
        ? parseInt(searchParams.get("bathrooms") as string)
        : undefined;
      const minRent = searchParams.get("minRent")
        ? parseFloat(searchParams.get("minRent") as string)
        : undefined;
      const maxRent = searchParams.get("maxRent")
        ? parseFloat(searchParams.get("maxRent") as string)
        : undefined;
      const type = searchParams.get("type") || undefined;
      const state = searchParams.get("state") || undefined;
      const city = searchParams.get("city") || undefined;

      const match: any = { deletedAt: null };

      if (type && Object.values(PropertyType).includes(type as any)) {
        match.type = type;
      }
      if (state) match["address.state"] = { $regex: state, $options: "i" };
      if (city) match["address.city"] = { $regex: city, $options: "i" };

      const unitMatch: any = {};
      if (status && Object.values(PropertyStatus).includes(status as any)) {
        unitMatch["units.status"] = status;
      }
      if (unitType) unitMatch["units.unitType"] = unitType;
      if (bedrooms !== undefined) unitMatch["units.bedrooms"] = bedrooms;
      if (bathrooms !== undefined) unitMatch["units.bathrooms"] = bathrooms;
      if (minRent !== undefined || maxRent !== undefined) {
        unitMatch["units.rentAmount"] = {};
        if (minRent !== undefined) unitMatch["units.rentAmount"].$gte = minRent;
        if (maxRent !== undefined) unitMatch["units.rentAmount"].$lte = maxRent;
      }

      const sortStage: any = {};
      const sortKey =
        sortBy === "rentAmount"
          ? "units.rentAmount"
          : sortBy === "squareFootage"
          ? "units.squareFootage"
          : sortBy === "unitNumber"
          ? "units.unitNumber"
          : sortBy === "status"
          ? "units.status"
          : sortBy === "name"
          ? "name"
          : "createdAt";
      sortStage[sortKey] = sortOrder === "asc" ? 1 : -1;

      const searchOr = search
        ? [
            { name: { $regex: search, $options: "i" } },
            { "units.unitNumber": { $regex: search, $options: "i" } },
          ]
        : undefined;

      const basePipeline: any[] = [{ $match: match }, { $unwind: "$units" }];

      if (searchOr) basePipeline.push({ $match: { $or: searchOr } });
      if (Object.keys(unitMatch).length > 0)
        basePipeline.push({ $match: unitMatch });

      const totalPipeline = [...basePipeline, { $count: "total" }];

      const totalResult = await Property.aggregate(totalPipeline);
      const total = totalResult[0]?.total || 0;

      // Get total unique properties count
      const uniquePropertiesPipeline = [
        ...basePipeline,
        { $group: { _id: "$_id" } },
        { $count: "total" },
      ];
      const uniquePropertiesResult = await Property.aggregate(
        uniquePropertiesPipeline
      );
      const totalProperties = uniquePropertiesResult[0]?.total || 0;

      const statusCountsPipeline = [
        ...basePipeline,
        {
          $group: {
            _id: "$units.status",
            count: { $sum: 1 },
          },
        },
      ];
      const statusCountsResult = await Property.aggregate(statusCountsPipeline);
      const statusCounts = {
        available: 0,
        occupied: 0,
        maintenance: 0,
        unavailable: 0,
      };

      statusCountsResult.forEach(
        ({ _id, count }: { _id?: string; count: number }) => {
          if (_id && _id in statusCounts) {
            statusCounts[_id as keyof typeof statusCounts] = count;
          }
        }
      );

      const paginatedPipeline = [
        ...basePipeline,
        { $sort: sortStage },
        { $skip: Math.max((page - 1) * limit, 0) },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            type: 1,
            status: 1,
            address: 1,
            images: 1,
            unitId: "$units._id",
            unitNumber: "$units.unitNumber",
            unitType: "$units.unitType",
            floor: "$units.floor",
            bedrooms: "$units.bedrooms",
            bathrooms: "$units.bathrooms",
            squareFootage: "$units.squareFootage",
            rentAmount: "$units.rentAmount",
            securityDeposit: "$units.securityDeposit",
            unitStatus: "$units.status",
            unitImages: "$units.images",
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const data = await Property.aggregate(paginatedPipeline);
      const totalPages = Math.ceil(total / limit) || 1;

      const pagination = {
        page,
        limit,
        total,
        totalProperties,
        totalPages,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        statusCounts,
      };

      return createSuccessResponse(data, "Units retrieved", pagination);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
