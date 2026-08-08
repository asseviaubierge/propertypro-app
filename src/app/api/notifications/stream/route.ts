import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createSseStream } from "@/lib/realtime/sse";
import { withAccessAndDB } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAccessAndDB({})(async (
  user,
  request: NextRequest
) => {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = String(session.user.id);

  return createSseStream(request.signal, (event) => {
    if (event.type !== "notification.created") return false;
    return event.userId === userId;
  });
});
