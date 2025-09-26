import { NextResponse } from "next/server";
import { isSheetsConfigured, getSheetsConfig } from "@/lib/pricing/sheetsClient";
import convex from "@/lib/convexClient";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const configured = isSheetsConfigured();
  const cfg = getSheetsConfig();

  let current: any = null;
  try {
    current = await convex.query(api.pricing.getCurrentSnapshot, {});
  } catch {
    // ignore; convex may not be running or schema not yet deployed
  }

  return NextResponse.json({
    success: true,
    configured,
    sheet: {
      spreadsheetIdPresent: !!cfg.spreadsheetId,
      pricingTab: cfg.pricingTab,
    },
    currentSnapshot: current
      ? {
          id: current._id,
          itemCount: current.itemCount,
          sheetVersion: current.sheetVersion || null,
          fetchedAt: current.fetchedAt,
        }
      : null,
  });
}



