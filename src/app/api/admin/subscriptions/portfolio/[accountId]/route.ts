import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";
import { calculatePortfolioSnapshot, getRecentContractEvents } from "@/lib/services/subscription-portfolio.service";

export const GET = withPermissionAndDB("system_settings")(
  async (_user: any, _req: NextRequest, context: any) => {
    try {
      const { accountId } = await context.params;
      const { snapshot, anomalies } = await calculatePortfolioSnapshot(accountId);

      const activeContract = await SubscriptionContract.findOne({
        accountId,
        status: "active",
      }).sort({ createdAt: -1 }).lean();

      const events = activeContract
        ? await getRecentContractEvents(String(activeContract._id))
        : [];

      return createSuccessResponse({ snapshot, anomalies, activeContract, events });
    } catch (error) {
      return handleApiError(error, "Impossible de synchroniser le portefeuille");
    }
  }
);
