import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Existing tasks table
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),

  // Customer messages from multiple channels
  messages: defineTable({
    // Message identification
    messageId: v.string(), // Unique ID from source platform
    channel: v.union(v.literal("email"), v.literal("whatsapp")),

    // Customer information
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerName: v.optional(v.string()),

    // Message content
    subject: v.optional(v.string()), // For email
    body: v.string(),
    attachments: v.optional(v.array(v.string())), // File URLs/paths

    // Attachment metadata for processing
    attachmentMetadata: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          mimeType: v.string(),
          size: v.number(),
          attachmentId: v.string(), // Gmail attachment ID or file path
          isExcel: v.boolean(),
          processed: v.boolean(),
          processedAt: v.optional(v.number()),
          extractedContent: v.optional(v.string()),
          processingError: v.optional(v.string()),
        })
      )
    ),

    // Processing status
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("parsed"),
      v.literal("completed"),
      v.literal("failed")
    ),

    // Timestamps
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),

    // AI processing results (will be added in Step 2)
    aiParsedData: v.optional(v.any()),

    // Soft-archive marker: when set, message is hidden from active views
    archivedAt: v.optional(v.number()),
  })
    .index("by_channel", ["channel"])
    .index("by_status", ["status"])
    .index("by_customer_email", ["customerEmail"])
    .index("by_customer_phone", ["customerPhone"])
    .index("by_message_id", ["messageId"]),

  // Customer profiles
  customers: defineTable({
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    name: v.string(),
    company: v.optional(v.string()),

    // SAP B1 integration
    sapCustomerCode: v.optional(v.string()),

    // Preferences
    preferredChannel: v.union(v.literal("email"), v.literal("whatsapp")),

    // Statistics
    messageCount: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    lastContactAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_sap_code", ["sapCustomerCode"]),

  // System logs for debugging
  systemLogs: defineTable({
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
    source: v.string(), // e.g., "gmail", "whatsapp", "api"
    data: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_level", ["level"])
    .index("by_source", ["source"]),
});
