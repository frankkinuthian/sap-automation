import { getAIConfig } from "./config";

interface MessageContent {
  subject?: string;
  body: string;
  customerInfo: {
    email: string;
    name?: string;
  };
}

interface AIAnalysisResult {
  category:
    | "quote_request"
    | "order_inquiry"
    | "support_request"
    | "general_inquiry"
    | "complaint"
    | "other";
  priority: "low" | "medium" | "high" | "urgent";
  confidence: number;
  extractedData: Record<string, unknown>;
}

export class OpenAIService {
  private config;

  constructor() {
    this.config = getAIConfig();
  }

  async analyzeMessage(content: MessageContent): Promise<AIAnalysisResult> {
    try {
      // This is a placeholder implementation
      // The actual OpenAI integration will be handled by the Inngest agents
      console.log("OpenAI Service - Analyzing message:", {
        subject: content.subject,
        customerEmail: content.customerInfo.email,
        bodyLength: content.body.length,
      });

      // For now, return a mock response
      // This will be replaced by actual agent-based processing
      return {
        category: "quote_request",
        priority: "medium",
        confidence: 0.85,
        extractedData: {
          // Mock extracted data
        },
      };
    } catch (error) {
      console.error("OpenAI Service error:", error);
      throw new Error(
        `OpenAI analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Utility method to validate API key
  validateConfiguration(): boolean {
    try {
      const config = this.config;
      return !!(config.openai.apiKey && config.openai.model);
    } catch (error) {
      console.error("OpenAI configuration validation failed:", error);
      return false;
    }
  }
}

// Export a singleton instance
export const openaiService = new OpenAIService();
