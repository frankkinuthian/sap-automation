import convex from "@/lib/convexClient";
import { api } from "@/convex/_generated/api";
import { normalizeName } from "@/lib/pricing/normalizer";

export type QuoteInputItem = {
  sku?: string;
  name?: string;
  quantity: number;
};

export type QuoteLineItem = {
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  currency?: string;
};

export type QuotePreview = {
  lineItems: QuoteLineItem[];
  subtotal: number;
  currency?: string;
  warnings?: string[];
  unresolved?: Array<{ sku?: string; name?: string; quantity: number; reason: string }>;
};

/**
 * Generate a quotation preview by resolving items against the current pricing snapshot.
 * - Resolves items by SKU when provided; otherwise by normalized name.
 * - Aggregates totals and returns warnings for unresolved or mixed-currency cases.
 */
export async function generateQuotationPreview(items: QuoteInputItem[]): Promise<QuotePreview> {
  if (!Array.isArray(items) || items.length === 0) {
    return { lineItems: [], subtotal: 0 };
  }

  // Fetch current pricing snapshot
  const snapshot = await convex.query(api.pricing.getCurrentSnapshot, {});
  if (!snapshot) {
    throw new Error("No current pricing snapshot configured. Please refresh pricing.");
  }

  // Build indexes for quick lookups
  const bySku = new Map<string, any>();
  const byNormName = new Map<string, any>();
  for (const it of snapshot.items || []) {
    if (it.sku) bySku.set(String(it.sku), it);
    if (it.normalizedName) byNormName.set(String(it.normalizedName), it);
  }

  const warnings: string[] = [];
  const unresolved: Array<{ sku?: string; name?: string; quantity: number; reason: string }> = [];
  const lineItems: QuoteLineItem[] = [];

  for (const input of items) {
    const qty = Number(input.quantity);
    if (!qty || qty <= 0) {
      unresolved.push({ sku: input.sku, name: input.name, quantity: qty, reason: "Invalid quantity" });
      continue;
    }

    let match: any | null = null;

    if (input.sku) {
      match = bySku.get(String(input.sku));
    }

    if (!match && input.name) {
      const n = normalizeName(input.name);
      match = byNormName.get(n) || null;
    }

    if (!match) {
      unresolved.push({ sku: input.sku, name: input.name, quantity: qty, reason: "Item not found in current snapshot" });
      continue;
    }

    const unitPrice = Number(match.unitPrice ?? 0);
    const quantity = qty;
    const totalPrice = round2(unitPrice * quantity);

    lineItems.push({
      sku: String(match.sku),
      name: String(match.name),
      unit: String(match.unit || "unit"),
      unitPrice: round2(unitPrice),
      quantity,
      totalPrice,
      currency: String(match.currency || "") || undefined,
    });
  }

  // Detect currency consistency
  const currencies = new Set(lineItems.map(li => li.currency).filter(Boolean) as string[]);
  let currency: string | undefined = undefined;
  if (currencies.size === 1) {
    currency = currencies.values().next().value;
  } else if (currencies.size > 1) {
    warnings.push("Mixed currencies detected across line items. Totals are computed without currency conversion.");
  }

  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.totalPrice, 0));

  const result: QuotePreview = { lineItems, subtotal };
  if (currency) result.currency = currency;
  if (warnings.length > 0) result.warnings = warnings;
  if (unresolved.length > 0) result.unresolved = unresolved;

  return result;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
