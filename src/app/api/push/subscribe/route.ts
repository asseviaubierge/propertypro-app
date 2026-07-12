import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint: string | undefined = body?.endpoint;
  const p256dh: string | undefined = body?.keys?.p256dh;
  const authKey: string | undefined = body?.keys?.auth;

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json(
      { error: "Missing subscription fields" },
      { status: 400 }
    );
  }

  await connectDB();

  const userObjectId = new Types.ObjectId(session.user.id);
  const userAgent = request.headers.get("user-agent") || undefined;

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId: userObjectId,
      endpoint,
      keys: { p256dh, auth: authKey },
      userAgent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ ok: true });
}
