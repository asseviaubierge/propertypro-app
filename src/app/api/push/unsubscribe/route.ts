import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint" },
      { status: 400 }
    );
  }

  await connectDB();

  await PushSubscription.deleteOne({
    endpoint,
    userId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
