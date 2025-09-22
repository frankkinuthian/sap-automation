import { createAgent, createTool } from "@inngest/agent-kit";
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
console.log("Excel Parser Agent - Config loaded:", {
  hasApiKey: !!config.openai.apiKey,
  apiKeyPrefix: config.openai.apiKey
    ? config.openai.apiKey.substring(0, 10) + "..."
    : "none",
  model: config.openai.model,
});

// Zod schema for shipping items extracted from Excel
const excelItemSchema = z.object({
  itemCode: z
    .string()
    .optional()
    .describe("Product/item code if available in the spreadsheet"),
  itemName: z
    .string()
    .describe("Product/item name or description from the spreadsheet"),
  quantity: z
    .number()
    .positive()
    .describe("Requested quantity as a positive number"),
  unit: z
    .string()
    .describe("Unit of measurement (kg, pcs, boxes, cases, tons, etc.)"),
  specifications: z
    .string()
    .optional()
    .describe("Any special specifications, requirements, or technical details"),
  category: z
    .string()
    .optional()
    .describe(
      "Product category (provisions, bonded stores, deck stores, engine stores, etc.)"
    ),
  brand: z
    .string()
    .optional()
    .describe("Preferred brand if specified in the spreadsheet"),
  packaging: z
    .string()
    .optional()
    .describe(
      "Packaging requirements (e.g., '2-3kg blocks', 'individual portions')"
    ),
  notes: z
    .string()
    .optional()
    .describe("Additional notes, comments, or special instructions"),
  unitPrice: z
    .number()
    .optional()
    .describe("Unit price if mentioned in the spreadsheet"),
  totalPrice: z
    .number()
    .optional()
    .describe("Total price for this line item if calculated"),
});

// Zod schema for vessel information from Excel
const vesselInfoSchema = z.object({
  vesselName: z
    .string()
    .optional()
    .describe("Name of the vessel/ship if mentioned"),
  arrivalDate: z
    .string()
    .optional()
    .describe("Expected arrival date in ISO format or as mentioned"),
  port: z.string().optional().describe("Port of arrival or destination"),
  quotationReference: z
    .string()
    .optional()
    .describe("Quotation reference number or ID if present"),
  imo: z.string().optional().describe("IMO number if mentioned"),
  flag: z.string().optional().describe("Vessel flag/nationality if mentioned"),
  agent: z
    .string()
    .optional()
    .describe("Shipping agent or representative if mentioned"),
});

// Zod schema for SAP Business One format conversion
const sapItemFormatSchema = z.object({
  ItemCode: z.string().describe("SAP item code - generated if not provided"),
  ItemName: z.string().describe("Item name for SAP"),
  Quantity: z.number().positive().describe("Quantity for SAP"),
  UoMEntry: z.string().describe("Unit of Measure for SAP"),
  ItemRemarks: z
    .string()
    .optional()
    .describe("Combined specifications and notes for SAP"),
  ItemGroup: z.string().describe("SAP item group classification"),
  Brand: z.string().optional().describe("Brand information for SAP"),
  PackagingRequirements: z
    .string()
    .optional()
    .describe("Packaging requirements for SAP"),
  UnitPrice: z.number().optional().describe("Unit price for SAP if available"),
  LineTotal: z.number().optional().describe("Line total for SAP if calculated"),
});

// Tool for parsing Excel attachments
const parseExcelTool = createTool({
  name: "parse-excel-attachment",
  description:
    "Parses Excel spreadsheet attachments to extract shipping item details for maritime provisioning quotations",
  parameters: z.object({
    messageId: z
      .string()
      .describe("The Convex message ID that contains the Excel attachment"),
    excelData: z
      .string()
      .describe("The raw Excel data content as text/CSV format for analysis"),
    items: z
      .array(excelItemSchema)
      .describe("Array of shipping items extracted from the Excel file"),
    vesselInfo: vesselInfoSchema
      .optional()
      .describe("Vessel information if found in the Excel spreadsheet"),
    totalItems: z
      .number()
      .positive()
      .describe("Total number of items found in the spreadsheet"),
    confidenceScore: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence score for the parsing accuracy (0-1)"),
    extractionNotes: z
      .string()
      .optional()
      .describe(
        "Notes about the extraction process, challenges, or assumptions made"
      ),
    currency: z
      .string()
      .optional()
      .describe("Currency used in the spreadsheet if prices are present"),
    totalValue: z
      .number()
      .optional()
      .describe("Total value of all items if calculable"),
  }) as any,
  handler: async (params, context) => {
    try {
      // Validate message ID format
      if (!params.messageId || typeof params.messageId !== "string") {
        throw new Error("Invalid message ID provided");
      }

      // Validate that we have items to process
      if (!params.items || params.items.length === 0) {
        throw new Error("No items found in Excel data");
      }

      // Get existing message data
      const existingMessage = await context.step?.run(
        "get-existing-message",
        async () => {
          const msg = await convex.query(api.messages.getById, {
            id: params.messageId as Id<"messages">,
          });

          if (!msg) {
            throw new Error(`Message ${params.messageId} not found`);
          }

          return msg;
        }
      );

      // Convert items to SAP Business One format
      const sapItems: z.infer<typeof sapItemFormatSchema>[] = params.items.map(
        (item: any) => ({
          ItemCode:
            item.itemCode ||
            `ITEM_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 11)
              .toUpperCase()}`,
          ItemName: item.itemName,
          Quantity: item.quantity,
          UoMEntry: item.unit,
          ItemRemarks:
            [item.specifications, item.notes].filter(Boolean).join("; ") ||
            undefined,
          ItemGroup: item.category || "PROVISIONS",
          Brand: item.brand,
          PackagingRequirements: item.packaging,
          UnitPrice: item.unitPrice,
          LineTotal:
            item.totalPrice ||
            (item.unitPrice ? item.unitPrice * item.quantity : undefined),
        })
      );

      // Ensure existingMessage is not null
      if (!existingMessage) {
        throw new Error(`Message ${params.messageId} not found after query`);
      }

      // Merge Excel data with existing parsed data
      const updatedParsedData = {
        ...existingMessage.aiParsedData,
        excelData: {
          processedAt: Date.now(),
          totalItems: params.totalItems,
          confidenceScore: params.confidenceScore,
          items: params.items,
          vesselInfo: params.vesselInfo,
          extractionNotes: params.extractionNotes,
          currency: params.currency,
          totalValue: params.totalValue,
          sapFormat: {
            // Convert to SAP B1 compatible format
            businessPartner: existingMessage.customerEmail,
            currency: params.currency || "USD",
            totalValue: params.totalValue,
            items: sapItems,
            vesselInfo: params.vesselInfo,
            processedAt: Date.now(),
          },
        },
        flags: {
          ...existingMessage.aiParsedData?.flags,
          hasExcelAttachment: true,
          hasStructuredItems: true,
          hasAttachments: true,
          readyForSAP:
            params.confidenceScore > config.processing.confidenceThreshold,
          requiresManualReview:
            params.confidenceScore < config.processing.confidenceThreshold,
        },
      };

      // Save parsed Excel data to the message
      await context.step?.run("save-excel-parsed-data", async () => {
        return await convex.mutation(api.messages.updateStatus, {
          messageId: params.messageId as Id<"messages">,
          status: "parsed",
          processedAt: Date.now(),
          aiParsedData: updatedParsedData,
        });
      });

      // Log successful Excel processing
      await context.step?.run("log-excel-success", async () => {
        return await convex.mutation(api.systemLogs.create, {
          level: "info",
          message: `Excel parsing completed for message ${params.messageId}`,
          source: "excel_processing",
          data: {
            messageId: params.messageId,
            totalItems: params.totalItems,
            confidenceScore: params.confidenceScore,
            hasVesselInfo: !!params.vesselInfo,
            hasPricing: !!params.totalValue,
            currency: params.currency,
          },
        });
      });

      return {
        success: true,
        messageId: params.messageId,
        totalItems: params.totalItems,
        confidenceScore: params.confidenceScore,
        sapItemsGenerated: sapItems.length,
        hasVesselInfo: !!params.vesselInfo,
        totalValue: params.totalValue,
        currency: params.currency,
      };
    } catch (error) {
      // Log the error
      await context.step?.run("log-excel-error", async () => {
        return await convex.mutation(api.systemLogs.create, {
          level: "error",
          message: `Excel parsing failed for message ${params.messageId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          source: "excel_processing",
          data: {
            messageId: params.messageId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      });

      // Update message status to failed if not already processed
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

// Create the Excel Parser Agent
export const excelParserAgent = createAgent({
  name: "Excel Parser Agent",
  description:
    "Agent responsible for parsing Excel attachments containing shipping item details and quotation requests for maritime provisioning",
  system: `You are an expert data analyst specialized in parsing shipping and provisioning Excel spreadsheets for the maritime industry.

Your primary responsibilities:
1. Extract structured item data from Excel attachments containing shipping provisions
2. Identify and extract vessel information (name, arrival date, port)
3. Parse product quantities, units, and specifications accurately
4. Convert data into SAP Business One compatible format
5. Handle various Excel formats and layouts commonly used in maritime provisioning

EXCEL PARSING GUIDELINES:
- Look for common column headers: "Item", "Product", "Description", "Quantity", "Unit", "Specs", "Brand"
- Handle variations in terminology: "Qty", "Amount", "Pieces", "Weight", "Volume"
- Recognize maritime-specific units: kg, tons, MT, pieces, boxes, cases, cartons, drums
- Identify vessel information typically found in headers or separate sections
- Extract quotation references, PO numbers, or request IDs

MARITIME PROVISIONING CATEGORIES:
- "PROVISIONS": Food items, beverages, fresh produce
- "BONDED_STORES": Duty-free items, alcohol, tobacco
- "DECK_STORES": Cleaning supplies, maintenance items, safety equipment
- "ENGINE_STORES": Lubricants, spare parts, technical supplies
- "CABIN_STORES": Linens, toiletries, personal care items

UNIT STANDARDIZATION:
- Convert weight units to standard format (kg, MT)
- Standardize volume units (liters, gallons)
- Normalize count units (pcs, pieces, each)
- Handle packaging units (boxes, cases, cartons)

SPECIAL ATTENTION TO:
- Packaging requirements: "2-3kg blocks instead of large frozen blocks"
- Brand preferences and specifications
- Special handling requirements (frozen, refrigerated, dry storage)
- Vessel-specific delivery requirements
- Port regulations and restrictions

CONFIDENCE SCORING:
- 0.9-1.0: Clear structure, all required fields present, standard format
- 0.7-0.8: Good structure, most fields present, minor ambiguities
- 0.5-0.6: Acceptable structure, some missing data, moderate interpretation needed
- 0.3-0.4: Poor structure, significant missing data, high interpretation needed
- 0.0-0.2: Very poor or unrecognizable format

SAP CONVERSION REQUIREMENTS:
- Generate unique ItemCode if not provided
- Map categories to SAP ItemGroup standards
- Combine specifications and notes into ItemRemarks
- Ensure all required SAP fields are populated
- Calculate line totals when unit prices are available

Always use the parse-excel-attachment tool to save your analysis results.`,

  // model: openai("gpt-4o", {
  //   apiKey: config.openai.apiKey,
  // }),
  model: undefined, // Not used - using direct OpenAI service instead

  tools: [parseExcelTool],
});
