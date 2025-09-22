import OpenAI from "openai";
import { getAIConfig } from "./config";

const config = getAIConfig();

// Initialize OpenAI client directly
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface MessageAnalysisResult {
  success: boolean;
  messageId: string;
  category: string;
  priority: string;
  confidenceScore: number;
  productsExtracted: number;
  extractedData: Record<string, unknown>;
}

export async function analyzeMessageWithOpenAI(
  messageId: string,
  messageContent: string,
  customerEmail: string,
  customerName?: string,
  subject?: string
): Promise<MessageAnalysisResult> {
  try {
    console.log("🤖 Direct OpenAI - Starting message analysis for:", messageId);

    const prompt = `You are an expert business analyst that processes customer communications to extract structured data for SAP Business One integration.

Analyze this customer message and extract structured business data:

FROM: ${customerEmail} ${customerName ? `(${customerName})` : ""}
SUBJECT: ${subject || "No subject"}

MESSAGE BODY:
${messageContent}

Please analyze this message and return a JSON response with the following structure:
{
  "category": "quote_request|order_inquiry|support_request|general_inquiry|complaint|other",
  "priority": "low|medium|high|urgent",
  "confidenceScore": 0.85,
  "intent": "Brief summary of what the customer is requesting",
  "customer": {
    "name": "extracted name if mentioned",
    "company": "company name if mentioned", 
    "email": "${customerEmail}",
    "phone": "phone number if mentioned",
    "address": "address if mentioned"
  },
  "products": [
    {
      "name": "product name",
      "code": "product code if mentioned",
      "quantity": 10,
      "unit": "kg|pcs|boxes|etc",
      "specifications": "any specifications mentioned"
    }
  ],
  "businessContext": {
    "deadline": "any deadline mentioned",
    "specialRequirements": ["list of special requirements"],
    "paymentTerms": "payment terms if mentioned",
    "deliveryLocation": "delivery location if mentioned",
    "vesselInfo": {
      "name": "vessel name if mentioned",
      "arrivalDate": "arrival date if mentioned", 
      "port": "port if mentioned"
    }
  },
  "urgencyKeywords": ["urgent", "asap", "emergency"],
  "flags": {
    "requiresManualReview": false,
    "hasCalculations": true,
    "readyForSAP": true,
    "isUrgent": false
  }
}

Focus on:
- Ship provisioning requests with vessel names, ports, and arrival dates
- Product quantities and units (kg, tons, pieces, boxes, cases)
- Urgent keywords: "urgent", "asap", "emergency", "critical", "immediately", "rush"
- Deadline indicators: "by [date]", "before [time]", "need by", "deadline"

Return only valid JSON, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: "system",
          content:
            "You are a business analyst that extracts structured data from customer messages. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log("📝 OpenAI response received, parsing JSON...");

    // Parse the JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse OpenAI response as JSON:", responseText);
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate required fields and set defaults
    const result = {
      category: parsedData.category || "general_inquiry",
      priority: parsedData.priority || "medium",
      confidenceScore: parsedData.confidenceScore || 0.5,
      intent: parsedData.intent || "Customer inquiry",
      customer: {
        name: parsedData.customer?.name || customerName,
        company: parsedData.customer?.company,
        email: customerEmail,
        phone: parsedData.customer?.phone,
        address: parsedData.customer?.address,
        isNewCustomer: false,
        discrepancies: [],
      },
      products: parsedData.products || [],
      businessContext: parsedData.businessContext || {},
      urgencyKeywords: parsedData.urgencyKeywords || [],
      flags: {
        requiresManualReview:
          parsedData.confidenceScore < config.processing.confidenceThreshold,
        hasCalculations:
          parsedData.products?.some(
            (p: Record<string, unknown>) =>
              p.quantity && typeof p.quantity === "number" && p.quantity > 0
          ) || false,
        hasAttachments: false,
        hasExcelAttachment: false,
        hasStructuredItems: false,
        readyForSAP:
          (parsedData.confidenceScore || 0) >=
          config.processing.confidenceThreshold,
        isUrgent: parsedData.priority === "urgent",
        hasDiscrepancies: false,
        ...(parsedData.flags || {}),
      },
    };

    console.log("✅ Direct OpenAI - Analysis completed successfully");
    console.log("Analysis result:", {
      category: result.category,
      priority: result.priority,
      confidenceScore: result.confidenceScore,
      productsCount: result.products.length,
    });

    return {
      success: true,
      messageId,
      category: result.category,
      priority: result.priority,
      confidenceScore: result.confidenceScore,
      productsExtracted: result.products.length,
      extractedData: result,
    };
  } catch (error) {
    console.error("❌ Direct OpenAI - Analysis failed:", error);
    throw error;
  }
}
