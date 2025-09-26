import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST() {
  try {
    const result = await inngest.send({
      name: "Pricing Refresh Was Requested",
      data: {},
    });
    return NextResponse.json({ success: true, eventId: result.ids[0] });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


