import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new pricing snapshot. Caller may later flip it to current.
export const createPricingSnapshot = mutation({
  args: {
    sheetVersion: v.optional(v.string()),
    fetchedAt: v.number(),
    source: v.object({ spreadsheetId: v.string(), tab: v.string() }),
    items: v.array(
      v.object({
        sku: v.string(),
        name: v.string(),
        normalizedName: v.string(),
        unit: v.string(),
        currency: v.string(),
        unitPrice: v.number(),
      })
    ),
    errors: v.optional(
      v.array(
        v.object({
          row: v.number(),
          reason: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const snapshotId = await ctx.db.insert("pricingSnapshots", {
      sheetVersion: args.sheetVersion,
      fetchedAt: args.fetchedAt,
      source: args.source,
      itemCount: args.items.length,
      current: false,
      items: args.items,
      errors: args.errors,
    });

    return snapshotId;
  },
});

// Flip the provided snapshot to current and unset previous current if present.
export const flipCurrentSnapshot = mutation({
  args: { snapshotId: v.id("pricingSnapshots") },
  handler: async (ctx, args) => {
    // Unset previous current (if any)
    const prev = await ctx.db
      .query("pricingSnapshots")
      .withIndex("by_current", (q) => q.eq("current", true))
      .first();
    if (prev) {
      await ctx.db.patch(prev._id, { current: false });
    }

    // Set new current
    await ctx.db.patch(args.snapshotId, { current: true });
    return { previousCurrentId: prev?._id || null, currentId: args.snapshotId };
  },
});

// Get the current active snapshot (if any)
export const getCurrentSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db
      .query("pricingSnapshots")
      .withIndex("by_current", (q) => q.eq("current", true))
      .first();
    return current || null;
  },
});

// Lookup a price by SKU or normalized name from the current snapshot
export const lookupPrice = query({
  args: { sku: v.optional(v.string()), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query("pricingSnapshots")
      .withIndex("by_current", (q) => q.eq("current", true))
      .first();
    if (!current) return null;
    let item = null;
    if (args.sku) {
      item = current.items.find(i => i.sku === args.sku);
    }
    if (!item && args.name) {
      const norm = args.name.trim().toLowerCase();
      item = current.items.find(i => i.normalizedName === norm);
    }
    return item || null;
  }
});


