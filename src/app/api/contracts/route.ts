import { createSuccessResponse, handleApiError, withAccessAndDB } from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";
import { UserRole } from "@/types";

export const GET = withAccessAndDB({})(async (user: any) => {
  try {
    const query = user.systemRole === UserRole.ADMIN ? {} : { accountId: user.id };
    const contracts = await SubscriptionContract.find(query)
      .select("contractNumber contractType title status signatureStatus sentAt viewedAt signedAt signatoryName startDate endDate createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return createSuccessResponse(contracts);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les contrats E-IMMO");
  }
});
