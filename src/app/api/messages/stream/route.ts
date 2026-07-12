import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createSseStream } from "@/lib/realtime/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = String(session.user.id);

  return createSseStream(request.signal, (event) => {
    if (event.type !== "message.created") return false;
    return event.participantIds.includes(userId);
  });
}
