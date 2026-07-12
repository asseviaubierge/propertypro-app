import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { leaseExpirationService } from "@/lib/services/lease-expiration.service";

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    // specific header check for cron jobs if needed
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

    const result = await leaseExpirationService.checkAndExpireLeases();

    return NextResponse.json({
      success: true,
      message: "Lease expiration check completed",
      data: result,
    });
  } catch (error: any) {
    console.error("Error in lease expiration cron:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
