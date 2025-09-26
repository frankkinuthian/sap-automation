import { NextRequest, NextResponse } from "next/server";
import { generateQuotationPreview, QuoteInputItem } from "@/lib/pricing/quotation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: QuoteInputItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json(
        { success: false, error: "'items' array is required" },
        { status: 400 }
      );
    }

    const preview = await generateQuotationPreview(items);
    return NextResponse.json({ success: true, preview });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.includes("pricing snapshot") ? 409 : 500 }
    );
  }
}
