/**
 * PropertyPro - Individual Invoice API Routes
 */

import { NextRequest } from "next/server";
import { Invoice } from "@/models";
import { InvoiceStatus, UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  withPermissionAndDB,
  isValidObjectId,
  parseRequestBody,
} from "@/lib/api-utils";
import { canAccessInvoice } from "@/lib/invoice-access";
import { computeEffectiveInvoiceStatus } from "@/lib/invoice/invoice-shared";
import { resolveInvoiceIssuer } from "@/lib/invoice/issuer-resolver";

const INVOICE_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["financial_management", "financial_reports"],
  match: "any" as const,
};

export const GET = withAccessAndDB(INVOICE_READ_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid invoice ID", 400);
      }

      const invoice = await Invoice.findOne({
        _id: id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("tenantId", "firstName lastName email phone")
        .populate("propertyId", "name address type ownerId managerId units")
        .populate("leaseId", "startDate endDate status propertyId unitId terms")
        .lean();

      if (!invoice) return createErrorResponse("Facture introuvable", 404);
      if (!(await canAccessInvoice(user, invoice))) {
        return createErrorResponse("Accès refusé", 403);
      }

      const issuer = await resolveInvoiceIssuer(invoice, user);

      const property = (invoice as any)?.propertyId;
      const unitId = (invoice as any)?.unitId || (invoice as any)?.leaseId?.unitId;
      const units = Array.isArray(property?.units) ? property.units : [];
      const unit = unitId
        ? units.find((candidate: any) => String(candidate?._id) === String(unitId)) || null
        : null;

      return createSuccessResponse(
        {
          ...invoice,
          issuer,
          unit,
          platform: { name: "E-IMMO", displayName: "GESTION E-IMMO" },
          status: computeEffectiveInvoiceStatus(invoice, new Date()),
        },
        "Facture récupérée avec succès"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const PUT = withPermissionAndDB("financial_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid invoice ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) return createErrorResponse(error!, 400);

      const invoice = await Invoice.findById(id);
      if (!invoice) return createErrorResponse("Invoice not found", 404);
      if (!(await canAccessInvoice(user, invoice))) {
        return createErrorResponse("Access denied", 403);
      }
      if (invoice.deletedAt) {
        return createErrorResponse("Invoice has been deleted", 409);
      }
      if (invoice.amountPaid > 0 || invoice.status === InvoiceStatus.PAID) {
        return createErrorResponse(
          "A paid or partially paid invoice cannot be structurally modified",
          409
        );
      }

      const allowed = [
        "category",
        "issueDate",
        "dueDate",
        "lineItems",
        "taxAmount",
        "discountAmount",
        "notes",
        "status",
        "metadata",
      ];
      const updateData: Record<string, unknown> = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          updateData[key] = body[key];
        }
      }

      if (updateData.status === InvoiceStatus.PAID) {
        return createErrorResponse("Use the payment workflow to mark an invoice paid", 400);
      }

      if (Array.isArray(updateData.lineItems)) {
        const subtotal = updateData.lineItems.reduce(
          (sum: number, item: any) => sum + Number(item.amount || 0),
          0
        );
        const tax = Number(updateData.taxAmount ?? invoice.taxAmount ?? 0);
        const discount = Number(
          updateData.discountAmount ?? invoice.discountAmount ?? 0
        );
        updateData.subtotal = subtotal;
        updateData.totalAmount = Math.max(0, subtotal + tax - discount);
        updateData.balanceRemaining = updateData.totalAmount;
      }

      Object.assign(invoice, updateData);
      await invoice.save();
      await invoice.populate([
        { path: "tenantId", select: "firstName lastName email phone" },
        { path: "propertyId", select: "name address type ownerId managerId" },
        { path: "leaseId", select: "startDate endDate status propertyId" },
      ]);

      return createSuccessResponse(invoice, "Invoice updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const PATCH = withPermissionAndDB("financial_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid invoice ID", 400);
      }
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) return createErrorResponse(error!, 400);

      const invoice = await Invoice.findById(id);
      if (!invoice) return createErrorResponse("Invoice not found", 404);
      if (!(await canAccessInvoice(user, invoice))) {
        return createErrorResponse("Access denied", 403);
      }

      const action = body.action;
      switch (action) {
        case "issue":
          if (invoice.status !== InvoiceStatus.SCHEDULED) {
            return createErrorResponse("Only scheduled invoices can be issued", 409);
          }
          invoice.status = InvoiceStatus.ISSUED;
          break;
        case "cancel":
          if (invoice.amountPaid > 0) {
            return createErrorResponse("Cannot cancel an invoice with payments", 409);
          }
          invoice.status = InvoiceStatus.CANCELLED;
          break;
        case "restore":
          if (!invoice.deletedAt) {
            return createErrorResponse("Invoice is not deleted", 409);
          }
          invoice.deletedAt = undefined;
          invoice.status = InvoiceStatus.SCHEDULED;
          break;
        default:
          return createErrorResponse("Unsupported invoice action", 400);
      }

      await invoice.save();
      return createSuccessResponse(invoice, "Invoice status updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const DELETE = withPermissionAndDB("financial_management")(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid invoice ID", 400);
      }

      const invoice = await Invoice.findById(id);
      if (!invoice) return createErrorResponse("Invoice not found", 404);
      if (!(await canAccessInvoice(user, invoice))) {
        return createErrorResponse("Access denied", 403);
      }
      if (invoice.amountPaid > 0) {
        return createErrorResponse("Cannot delete an invoice with payments", 409);
      }

      invoice.deletedAt = new Date();
      invoice.status = InvoiceStatus.CANCELLED;
      await invoice.save();

      return createSuccessResponse({ id: invoice._id }, "Invoice deleted successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);
