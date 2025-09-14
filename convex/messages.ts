import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new message
export const create = mutation({
  args: {
    messageId: v.string(),
    channel: v.union(v.literal("email"), v.literal("whatsapp")),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerName: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("parsed"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Check if message already exists
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
        .first();

      if (existing) {
        console.log(`Message ${args.messageId} already exists`);
        return existing._id;
      }

      // Create the message
      const messageId = await ctx.db.insert("messages", args);

      // Log the event
      await ctx.db.insert("systemLogs", {
        level: "info",
        message: `New message received from ${args.channel}`,
        source: args.channel,
        data: {
          messageId: args.messageId,
          customer: args.customerEmail || args.customerPhone,
        },
        timestamp: Date.now(),
      });

      // Create or update customer profile
      await upsertCustomer(ctx, args);

      return messageId;
    } catch (error) {
      // Log the error
      await ctx.db.insert("systemLogs", {
        level: "error",
        message: `Failed to create message: ${error}`,
        source: args.channel,
        data: { messageId: args.messageId, error: String(error) },
        timestamp: Date.now(),
      });
      throw error;
    }
  },
});

// Get all messages with pagination
export const getAllMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db.query("messages").order("desc").take(limit);
  },
});

// Get messages by status
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("parsed"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

// Get messages by channel
export const getByChannel = query({
  args: {
    channel: v.union(v.literal("email"), v.literal("whatsapp")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channel", args.channel))
      .order("desc")
      .take(50);
  },
});

// Get messages by customer email
export const getByCustomerEmail = query({
  args: {
    customerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_customer_email", (q) =>
        q.eq("customerEmail", args.customerEmail),
      )
      .order("desc")
      .collect();
  },
});

// Update message status
export const updateStatus = mutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("parsed"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    processedAt: v.optional(v.number()),
    aiParsedData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
    };

    if (args.processedAt) {
      updates.processedAt = args.processedAt;
    }

    if (args.aiParsedData) {
      updates.aiParsedData = args.aiParsedData;
    }

    return await ctx.db.patch(args.messageId, updates);
  },
});

// Get message statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allMessages = await ctx.db.query("messages").collect();

    const stats = {
      total: allMessages.length,
      byStatus: {
        received: 0,
        processing: 0,
        parsed: 0,
        completed: 0,
        failed: 0,
      },
      byChannel: {
        email: 0,
        whatsapp: 0,
      },
      todayCount: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    allMessages.forEach((message) => {
      // Count by status
      stats.byStatus[message.status]++;

      // Count by channel
      stats.byChannel[message.channel]++;

      // Count today's messages
      if (message.receivedAt >= todayTimestamp) {
        stats.todayCount++;
      }
    });

    return stats;
  },
});

// Helper function to create/update customer
async function upsertCustomer(ctx: any, messageData: any) {
  try {
    // Try to find existing customer
    let customer = null;
    if (messageData.customerEmail) {
      customer = await ctx.db
        .query("customers")
        .withIndex("by_email", (q: any) =>
          q.eq("email", messageData.customerEmail),
        )
        .first();
    } else if (messageData.customerPhone) {
      customer = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q: any) =>
          q.eq("phone", messageData.customerPhone),
        )
        .first();
    }

    if (customer) {
      // Update existing customer
      await ctx.db.patch(customer._id, {
        lastContactAt: messageData.receivedAt,
        name: messageData.customerName || customer.name,
        messageCount: (customer.messageCount || 0) + 1,
      });
    } else {
      // Create new customer
      await ctx.db.insert("customers", {
        email: messageData.customerEmail,
        phone: messageData.customerPhone,
        name: messageData.customerName || "Unknown Customer",
        preferredChannel: messageData.channel,
        messageCount: 1,
        createdAt: messageData.receivedAt,
        lastContactAt: messageData.receivedAt,
      });
    }
  } catch (error) {
    console.error("Error upserting customer:", error);
    // Log the error but don't throw - customer creation shouldn't block message creation
    await ctx.db.insert("systemLogs", {
      level: "warning",
      message: `Failed to upsert customer: ${error}`,
      source: "customer_management",
      data: {
        customerEmail: messageData.customerEmail,
        customerPhone: messageData.customerPhone,
        error: String(error),
      },
      timestamp: Date.now(),
    });
  }
}
