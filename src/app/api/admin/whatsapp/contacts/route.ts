export const dynamic = "force-dynamic";

import {
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import User from "@/models/User";
import WhatsAppVerificationRequest from "@/models/WhatsAppVerificationRequest";

export const GET = withPermissionAndDB("system_settings")(async () => {
  try {
    const [requests, verifiedUsers] = await Promise.all([
      WhatsAppVerificationRequest.find({ status: { $in: ["pending", "rejected"] } })
        .sort({ requestedAt: -1 })
        .populate(
          "userId",
          "firstName lastName businessName email phone role accountType whatsappNumber whatsappVerificationStatus whatsappVerifiedAt whatsappPreviousNumber whatsappChangeRequestedNumber whatsappChangeReason whatsappChangeStatus whatsappChangeRequestedAt whatsappChangeReviewedAt"
        )
        .lean(),
      User.find({
        whatsappVerificationStatus: "verified",
        isActive: { $ne: false },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .select(
          "_id firstName lastName businessName email phone whatsappNumber whatsappVerificationStatus whatsappVerifiedAt role accountType whatsappPreviousNumber whatsappChangeRequestedNumber whatsappChangeReason whatsappChangeStatus whatsappChangeRequestedAt whatsappChangeReviewedAt"
        )
        .sort({ whatsappVerifiedAt: -1 })
        .lean(),
    ]);

    const requestRows = requests
      .filter((request: any) => request.userId)
      .map((request: any) => {
        const user: any = request.userId;
        return {
          ...user,
          _id: String(user._id),
          requestId: String(request._id),
          whatsappNumber: request.requestedNumber,
          whatsappVerificationStatus: request.status,
          whatsappVerificationCode: request.verificationCode,
          whatsappVerificationRequestedAt: request.requestedAt,
          messageConfirmedReceived: request.messageConfirmedReceived,
        };
      });

    const usersWithVerificationRequest = new Set(
      requestRows
        .filter((row: any) => row.whatsappVerificationStatus === "pending")
        .map((row: any) => String(row._id))
    );

    const verifiedRows = verifiedUsers
      .filter((user: any) => !usersWithVerificationRequest.has(String(user._id)))
      .map((user: any) => ({
        ...user,
        _id: String(user._id),
        requestId: null,
      }));

    return createSuccessResponse([...requestRows, ...verifiedRows]);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les vérifications WhatsApp");
  }
});
