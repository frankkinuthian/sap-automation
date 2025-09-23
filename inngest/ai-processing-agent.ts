import { createAgent, createTool, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getAIConfig } from "@/lib/ai/config";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Get AI configuration
const config = getAIConfig();

// Debug: Log configuration (without exposing the full API key)
console.log("AI Processing Agent - Config loaded:", {
  hasApiKey: !!config.openai.apiKey,
  apiKeyPrefix: config.openai.apiKey
    ? config.openai.apiKey.substring(0, 10) + "..."
    : "none",
  model: config.openai.model,
});

// Zod schema for customer information
const customerInfoSchema = z.object({
  name: z.string().optional().describe("Customer's full name if mentioned"),
  company: z.string().optional().describe("Company name if mentioned"),
  email: z.string().describe("Customer's email address"),
  phone: z.string().optional().describe("Phone number if mentioned"),
  address: z.string().optional().describe("Physical address if mentioned"),
});

// Zod schema for product information
const productSchema = z.object({
  name: z.string().describe("Product or item name"),
  code: z.string().optional().describe("Product code or SKU if mentioned"),
  quantity: z.number().optional().describe("Requested quantity"),
  unit: z
    .string()
    .optional()
    .describe("Unit of measurement (kg, pcs, boxes, etc.)"),
  specifications: z
    .string()
    .optional()
    .describe("Technical specifications or requirements"),
});

// Zod schema for business context
const businessContextSchema = z.object({
  deadline: z
    .string()
    .optional()
    .describe("Any mentioned deadlines or time requirements"),
  specialRequirements: z
    .array(z.string())
    .optional()
    .describe("Special requirements or instructions"),
  paymentTerms: z.string().optional().describe("Payment terms if mentioned"),
  deliveryLocation: z
    .string()
    .optional()
    .describe("Delivery location or address"),
  vesselInfo: z
    .object({
      name: z.string().optional().describe("Vessel or ship name"),
      arrivalDate: z.string().optional().describe("Expected arrival date"),
      port: z.string().optional().describe("Port of arrival"),
    })
    .optional()
    .describe("Vessel information for maritime provisioning"),
});

// Tool for analyzing customer messages
const analyzeMessageTool = createTool({
  name: "analyze-message",
  description:
    "Analyzes customer message content to extract business intent and structured data",
  parameters: z.object({
    messageId: z.string().describe("The Convex message ID to process"),
    category: z
      .enum([
        "quote_request",
        "order_inquiry",
        "support_request",
        "general_inquiry",
        "complaint",
        "other",
      ])
      .describe("Message category based on business intent"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .describe("Priority level based on urgency indicators"),
    customerInfo: customerInfoSchema,
    products: z
      .array(productSchema)
      .describe("Array of products or items mentioned"),
    businessContext: businessContextSchema,
    confidenceScore: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence score for the analysis (0-1)"),
    extractedIntent: z
      .string()
      .describe("Brief summary of what the customer is requesting"),
    urgencyKeywords: z
      .array(z.string())
      .optional()
      .describe("Urgent keywords found in the message"),
  }) as any,
  handler: async (params) => {
    try {
      console.log("🔧 AI Processing Tool - Starting execution");
      console.log("Tool params:", {
        messageId: params.messageId,
        category: params.category,
        priority: params.priority,
        confidenceScore: params.confidenceScore,
      });

      // Validate message ID format
      if (!params.messageId || typeof params.messageId !== "string") {
        throw new Error("Invalid message ID provided");
      }

      // Prepare the AI parsed data structure
      const aiParsedData = {
        processedAt: Date.now(),
        processingVersion: "1.0",
        aiModel: config.openai.model,
        confidenceScore: params.confidenceScore,

        // Intent classification
        category: params.category,
        intent: params.extractedIntent,
        priority: params.priority,

        // Customer information
        customer: {
          ...params.customerInfo,
          isNewCustomer: false, // Will be determined by database lookup
          discrepancies: [], // Will be populated if differences found
        },

        // Product information
        products: params.products.map((product: any) => ({
          ...product,
          alternatives: [], // Can be populated in future enhancements
          confidence: params.confidenceScore, // Individual product confidence
        })),

        // Business context
        businessContext: params.businessContext,

        // Processing flags
        flags: {
          requiresManualReview:
            params.confidenceScore < config.processing.confidenceThreshold,
          hasCalculations: params.products.some(
            (p: any) => p.quantity && p.quantity > 0
          ),
          hasAttachments: false, // Will be updated when attachment processing is implemented
          hasExcelAttachment: false,
          hasStructuredItems: false,
          readyForSAP:
            params.confidenceScore >= config.processing.confidenceThreshold,
          isUrgent: params.priority === "urgent",
          hasDiscrepancies: false, // Will be updated after customer validation
        },

        // Store urgency keywords for debugging
        urgencyKeywords: params.urgencyKeywords || [],

        // Raw AI responses for debugging
        rawResponses: {
          openai: {
            model: config.openai.model,
            timestamp: Date.now(),
            parameters: params,
          },
        },
      };

      // Update message status and save parsed data
      await convex.mutation(api.messages.updateStatus, {
        messageId: params.messageId as Id<"messages">,
        status: "parsed",
        processedAt: Date.now(),
        aiParsedData,
      });

      // Log successful processing
      await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `AI processing completed for message ${params.messageId}`,
        source: "ai_processing",
        data: {
          messageId: params.messageId,
          category: params.category,
          priority: params.priority,
          confidenceScore: params.confidenceScore,
          productsCount: params.products.length,
        },
      });

      const result = {
        success: true,
        messageId: params.messageId,
        category: params.category,
        priority: params.priority,
        confidenceScore: params.confidenceScore,
        productsExtracted: params.products.length,
      };

      console.log("✅ AI Processing Tool - Execution completed successfully");
      console.log("Tool result:", result);
      return result;
    } catch (error) {
      // Log the error
      await convex.mutation(api.systemLogs.create, {
        level: "error",
        message: `AI processing failed for message ${params.messageId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        source: "ai_processing",
        data: {
          messageId: params.messageId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      // Update message status to failed
      try {
        await convex.mutation(api.messages.updateStatus, {
          messageId: params.messageId as Id<"messages">,
          status: "failed",
          processedAt: Date.now(),
        });
      } catch (updateError) {
        console.error(
          "Failed to update message status to failed:",
          updateError
        );
      }

      throw error;
    }
  },
});

// Create the AI Processing Agent
export const aiProcessingAgent = createAgent({
  name: "AI Message Processing Agent",
  description:
    "Agent responsible for analyzing customer messages and extracting structured business data for SAP Business One integration",
  system: `You are an expert business analyst that processes customer communications to extract structured data for SAP Business One integration.

Your primary responsibilities:
1. Analyze message content to understand business intent and categorize requests
2. Extract customer information and contact details accurately
3. Identify and extract product information, quantities, and specifications
4. Determine priority levels based on urgency indicators and deadlines
5. Extract business context like vessel information, delivery requirements, and special instructions

CATEGORIZATION GUIDELINES:
- "quote_request": Messages asking for pricing, quotations, or product availability
- "order_inquiry": Messages about existing orders, delivery status, or order modifications  
- "support_request": Messages reporting problems or asking for technical help
- "general_inquiry": General questions about services, capabilities, or information requests
- "complaint": Messages expressing dissatisfaction, complaints, or issues
- "other": Messages that don't fit the above categories

PRIORITY DETECTION:
- "urgent": Contains urgent keywords (urgent, asap, emergency, critical) or immediate deadlines
- "high": Time-sensitive requests, VIP customers, or important business opportunities
- "medium": Standard business requests with reasonable timelines
- "low": General inquiries or non-time-sensitive requests

SPECIAL ATTENTION TO:
- Ship provisioning requests with vessel names, ports, and arrival dates
- Product quantities and units of measurement (kg, tons, pieces, boxes, cases)
- Special packaging requirements (e.g., "smaller frozen blocks", "2-3kg portions")
- Payment terms and delivery locations
- Urgent keywords: "urgent", "asap", "emergency", "critical", "immediately", "rush"
- Deadline indicators: "by [date]", "before [time]", "need by", "deadline"

CONFIDENCE SCORING:
- 0.9-1.0: Very clear intent, complete information, high certainty
- 0.7-0.8: Clear intent, most information present, good certainty
- 0.5-0.6: Somewhat clear intent, some missing information, moderate certainty
- 0.3-0.4: Unclear intent, significant missing information, low certainty
- 0.0-0.2: Very unclear or insufficient information

Always use the analyze-message tool to save your analysis results.`,

  model: openai({
    model: config.openai.model,
    apiKey: config.openai.apiKey,
  }),

  tools: [analyzeMessageTool],
});
