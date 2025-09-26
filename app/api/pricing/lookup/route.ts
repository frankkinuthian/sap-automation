import { api } from "@/convex/_generated/api";
import convex from "@/lib/convexClient";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { sku, name } = await req.json();
  const result = await convex.query(api.pricing.lookupPrice, { sku, name });
  return NextResponse.json({ result });
}