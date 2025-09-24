import OpenAI from "openai";
import { getAIConfig } from "./config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const config = getAIConfig();
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize OpenAI client directly
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface ExcelProcessingResult {
  success: boolean;
  messageId: string;
  totalItems: number;
  confidenceScore: number;
  hasVesselInfo: boolean;
  totalValue?: number;
  currency?: string;
}

export async function processExcelWithOpenAI(
  messageId: string,
  excelData: string,
  customerEmail: string,
  customerName?: string,
  filename?: string,
  fileSize?: number,
  isValidFormat?: boolean
): Promise<ExcelProcessingResult> {
  try {
    console.log("🤖 Direct OpenAI - Starting Excel analysis for:", messageId);

    const prompt = `You are an expert data analyst specialized in parsing shipping and provisioning Excel spreadsheets for the maritime industry.

Analyze this Excel spreadsheet data and extract structured information:

CUSTOMER: ${customerEmail} ${customerName ? `(${customerName})` : ""}
FILENAME: ${filename || "Unknown"}
FILE_SIZE: ${fileSize || 0} bytes
VALID_FORMAT: ${isValidFormat}

EXCEL DATA:
${excelData}

Please analyze this Excel data and return a JSON response with the following structure:
{
  "totalItems": 5,
  "confidenceScore": 0.85,
  "currency": "USD",
  "totalValue": 1250.50,
  "extractionNotes": "Successfully extracted 5 items from well-structured spreadsheet",
  "items": [
    {
      "itemCode": "ITEM001",
      "itemName": "Product name from spreadsheet",
      "quantity": 10,
      "unit": "kg",
      "specifications": "Any specifications mentioned",
      "category": "PROVISIONS",
      "brand": "Brand if mentioned",
      "packaging": "Packaging requirements",
      "notes": "Additional notes",
      "unitPrice": 12.50,
      "totalPrice": 125.00
    }
  ],
  "vesselInfo": {
    "vesselName": "Vessel name if found",
    "arrivalDate": "2024-01-15",
    "port": "Port name",
    "quotationReference": "Quote ref if found",
    "imo": "IMO number if found",
    "flag": "Vessel flag if found",
    "agent": "Agent name if found"
  }
}

PARSING GUIDELINES:
- Look for common column headers: "Item", "Product", "Description", "Quantity", "Unit", "Specs", "Brand"
- Handle variations: "Qty", "Amount", "Pieces", "Weight", "Volume"
- Recognize maritime units: kg, tons, MT, pieces, boxes, cases, cartons, drums
- Extract vessel information from headers or separate sections
- Identify quotation references, PO numbers, or request IDs

MARITIME CATEGORIES:
- "PROVISIONS": Food items, beverages, fresh produce
- "BONDED_STORES": Duty-free items, alcohol, tobacco  
- "DECK_STORES": Cleaning supplies, maintenance items, safety equipment
- "ENGINE_STORES": Lubricants, spare parts, technical supplies
- "CABIN_STORES": Linens, toiletries, personal care items

CONFIDENCE SCORING:
- 0.9-1.0: Clear structure, all required fields present
- 0.7-0.8: Good structure, most fields present, minor ambiguities
- 0.5-0.6: Acceptable structure, some missing data
- 0.3-0.4: Poor structure, significant missing data
- 0.0-0.2: Very poor or unrecognizable format

Return only valid JSON, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert maritime provisioning data analyst. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: config.openai.temperature,
      max_tokens: 2000, // Increased for Excel data processing
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log("📝 OpenAI Excel response received, parsing JSON...");

    // Parse the JSON response
    let parsedData;
    try {
      // Clean the response text by removing markdown code blocks if present
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      parsedData = JSON.parse(cleanedResponse);
    } catch (error) {
      console.error(
        "Failed to parse OpenAI Excel response as JSON:",
        responseText
      );
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate and process the data
    const items = parsedData.items || [];
    const totalItems = parsedData.totalItems || items.length;
    const confidenceScore = parsedData.confidenceScore || 0.5;

    // Convert items to SAP Business One format
    const sapItems = items.map((item: any) => ({
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
    }));

    // Get existing message data
    const existingMessage = await convex.query(api.messages.getById, {
      id: messageId as Id<"messages">,
    });

    if (!existingMessage) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Merge Excel data with existing parsed data
    const updatedParsedData = {
      ...existingMessage.aiParsedData,
      excelData: {
        processedAt: Date.now(),
        totalItems,
        confidenceScore,
        items,
        vesselInfo: parsedData.vesselInfo,
        extractionNotes: parsedData.extractionNotes,
        currency: parsedData.currency,
        totalValue: parsedData.totalValue,
        sapFormat: {
          businessPartner: existingMessage.customerEmail,
          currency: parsedData.currency || "USD",
          totalValue: parsedData.totalValue,
          items: sapItems,
          vesselInfo: parsedData.vesselInfo,
          processedAt: Date.now(),
        },
      },
      flags: {
        ...existingMessage.aiParsedData?.flags,
        hasExcelAttachment: true,
        hasStructuredItems: true,
        hasAttachments: true,
        readyForSAP: confidenceScore > config.processing.confidenceThreshold,
        requiresManualReview:
          confidenceScore < config.processing.confidenceThreshold,
      },
    };

    // Save parsed Excel data to the message
    await convex.mutation(api.messages.updateStatus, {
      messageId: messageId as Id<"messages">,
      status: "parsed",
      processedAt: Date.now(),
      aiParsedData: updatedParsedData,
    });

    // Log successful Excel processing
    await convex.mutation(api.systemLogs.create, {
      level: "info",
      message: `Excel parsing completed for message ${messageId}`,
      source: "excel_processing",
      data: {
        messageId,
        totalItems,
        confidenceScore,
        hasVesselInfo: !!parsedData.vesselInfo,
        hasPricing: !!parsedData.totalValue,
        currency: parsedData.currency,
      },
    });

    console.log("✅ Direct OpenAI - Excel analysis completed successfully");

    return {
      success: true,
      messageId,
      totalItems,
      confidenceScore,
      hasVesselInfo: !!parsedData.vesselInfo,
      totalValue: parsedData.totalValue,
      currency: parsedData.currency,
    };
  } catch (error) {
    console.error("❌ Direct OpenAI - Excel analysis failed:", error);

    // Log the error
    await convex.mutation(api.systemLogs.create, {
      level: "error",
      message: `Excel parsing failed for message ${messageId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      source: "excel_processing",
      data: {
        messageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    // Update message status to failed
    try {
      await convex.mutation(api.messages.updateStatus, {
        messageId: messageId as Id<"messages">,
        status: "failed",
        processedAt: Date.now(),
      });
    } catch (updateError) {
      console.error("Failed to update message status to failed:", updateError);
    }

    throw error;
  }
}
