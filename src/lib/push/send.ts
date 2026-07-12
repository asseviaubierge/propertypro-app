import webpush from "web-push";
import PushSubscription from "@/models/PushSubscription";
import connectDB from "@/lib/mongodb";

let configured = false;

function configureWebPush() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@propertypro.app";
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0) return;
  if (!configureWebPush()) return;

  try {
    await connectDB();
    const subs = await PushSubscription.find({
      userId: { $in: userIds },
    }).lean();

    if (subs.length === 0) return;

    const body = JSON.stringify({
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      ...payload,
    });

    const staleIds: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            body
          );
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            staleIds.push(String(sub._id));
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await PushSubscription.deleteMany({ _id: { $in: staleIds } });
    }
  } catch (err) {
    console.error("sendPushToUsers failed:", err);
  }
}
