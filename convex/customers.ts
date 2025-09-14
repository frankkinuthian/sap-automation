import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all customers with pagination
export const getAllCustomers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db.query("customers").order("desc").take(limit);
  },
});

// Get customer by email
export const getByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

// Get customer by phone
export const getByPhone = query({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
  },
});

// Get customer by SAP customer code
export const getBySapCode = query({
  args: {
    sapCustomerCode: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_sap_code", (q) =>
        q.eq("sapCustomerCode", args.sapCustomerCode),
      )
      .first();
  },
});

// Search customers by name or company
export const searchCustomers = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const allCustomers = await ctx.db.query("customers").collect();
    const searchLower = args.searchTerm.toLowerCase();

    return allCustomers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchLower) ||
        (customer.company &&
          customer.company.toLowerCase().includes(searchLower)) ||
        (customer.email && customer.email.toLowerCase().includes(searchLower)),
    );
  },
});

// Create a new customer
export const create = mutation({
  args: {
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    name: v.string(),
    company: v.optional(v.string()),
    sapCustomerCode: v.optional(v.string()),
    preferredChannel: v.union(v.literal("email"), v.literal("whatsapp")),
  },
  handler: async (ctx, args) => {
    try {
      // Check if customer already exists
      let existingCustomer = null;

      if (args.email) {
        existingCustomer = await ctx.db
          .query("customers")
          .withIndex("by_email", (q) =>
            q.eq("email", args.email!.toLowerCase()),
          )
          .first();
      }

      if (!existingCustomer && args.phone) {
        existingCustomer = await ctx.db
          .query("customers")
          .withIndex("by_phone", (q) => q.eq("phone", args.phone))
          .first();
      }

      if (existingCustomer) {
        throw new Error("Customer already exists with this email or phone");
      }

      const customerId = await ctx.db.insert("customers", {
        email: args.email?.toLowerCase(),
        phone: args.phone,
        name: args.name,
        company: args.company,
        sapCustomerCode: args.sapCustomerCode,
        preferredChannel: args.preferredChannel,
        messageCount: 0,
        createdAt: Date.now(),
        lastContactAt: Date.now(),
      });

      // Log the event
      await ctx.db.insert("systemLogs", {
        level: "info",
        message: `New customer created: ${args.name}`,
        source: "customer_management",
        data: {
          customerId,
          email: args.email,
          phone: args.phone,
        },
        timestamp: Date.now(),
      });

      return customerId;
    } catch (error) {
      // Log the error
      await ctx.db.insert("systemLogs", {
        level: "error",
        message: `Failed to create customer: ${error}`,
        source: "customer_management",
        data: {
          customerData: args,
          error: String(error),
        },
        timestamp: Date.now(),
      });
      throw error;
    }
  },
});

// Update customer information
export const update = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    sapCustomerCode: v.optional(v.string()),
    preferredChannel: v.optional(
      v.union(v.literal("email"), v.literal("whatsapp")),
    ),
  },
  handler: async (ctx, args) => {
    try {
      const updates: any = {};

      if (args.name !== undefined) updates.name = args.name;
      if (args.company !== undefined) updates.company = args.company;
      if (args.sapCustomerCode !== undefined)
        updates.sapCustomerCode = args.sapCustomerCode;
      if (args.preferredChannel !== undefined)
        updates.preferredChannel = args.preferredChannel;

      await ctx.db.patch(args.customerId, updates);

      // Log the event
      await ctx.db.insert("systemLogs", {
        level: "info",
        message: `Customer updated`,
        source: "customer_management",
        data: {
          customerId: args.customerId,
          updates,
        },
        timestamp: Date.now(),
      });

      return args.customerId;
    } catch (error) {
      // Log the error
      await ctx.db.insert("systemLogs", {
        level: "error",
        message: `Failed to update customer: ${error}`,
        source: "customer_management",
        data: {
          customerId: args.customerId,
          error: String(error),
        },
        timestamp: Date.now(),
      });
      throw error;
    }
  },
});

// Get customer statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allCustomers = await ctx.db.query("customers").collect();

    const stats = {
      total: allCustomers.length,
      byChannel: {
        email: 0,
        whatsapp: 0,
      },
      withSapCode: 0,
      newThisWeek: 0,
      activeThisWeek: 0,
    };

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    allCustomers.forEach((customer) => {
      // Count by preferred channel
      stats.byChannel[customer.preferredChannel]++;

      // Count customers with SAP codes
      if (customer.sapCustomerCode) {
        stats.withSapCode++;
      }

      // Count new customers this week
      if (customer.createdAt >= oneWeekAgo) {
        stats.newThisWeek++;
      }

      // Count active customers this week
      if (customer.lastContactAt >= oneWeekAgo) {
        stats.activeThisWeek++;
      }
    });

    return stats;
  },
});

// Get recent customers
export const getRecentCustomers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    return await ctx.db.query("customers").order("desc").take(limit);
  },
});

// Get most active customers
export const getMostActive = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const customers = await ctx.db.query("customers").collect();

    // Sort by message count descending
    return customers
      .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
      .slice(0, limit);
  },
});
