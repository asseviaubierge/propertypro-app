import { NextRequest } from "next/server";
import { Message, Conversation } from "@/models";
import { withPermissionAndDB } from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export const GET = withPermissionAndDB("profile_management")(
  async (user, _request: NextRequest) => {
    const access = await resolveAccessProfile(user.role);
    const encoder = new TextEncoder();
    let closed = false;
    let lastSeen = new Date();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        send({ type: "ready" });

        const poll = async () => {
          if (closed) return;
          try {
            const conversationQuery: Record<string, any> = { deletedAt: null };
            if (!access.isAdmin) {
              conversationQuery.participants = { $elemMatch: { userId: user.id, isActive: true } };
            }
            const conversationIds = await Conversation.distinct("_id", conversationQuery);
            const messages = await Message.find({
              conversationId: { $in: conversationIds },
              createdAt: { $gt: lastSeen },
              deletedAt: null,
            })
              .populate("senderId", "firstName lastName email avatar")
              .sort({ createdAt: 1 })
              .limit(100)
              .lean();

            for (const message of messages as any[]) {
              const conversation = await Conversation.findById(message.conversationId).select("participants.userId").lean();
              send({
                type: "message.created",
                conversationId: String(message.conversationId),
                participantIds: (conversation?.participants || []).map((p: any) => String(p.userId)),
                message,
              });
              lastSeen = new Date(message.createdAt);
            }
            send({ type: "heartbeat", at: new Date().toISOString() });
          } catch (error) {
            console.error("Flux de messagerie:", error);
          }
        };

        const interval = setInterval(() => void poll(), 3000);
        const timeout = setTimeout(() => {
          closed = true;
          clearInterval(interval);
          controller.close();
        }, 25_000);

        void poll();
        return () => {
          closed = true;
          clearInterval(interval);
          clearTimeout(timeout);
        };
      },
      cancel() { closed = true; },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
);
