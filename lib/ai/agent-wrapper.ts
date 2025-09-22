import { getAIConfig } from "./config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Get AI configuration
const config = getAIConfig();

/**
 * Error types for AI processing
 */
export enum AIErrorType {
  RATE_LIMIT = "rate_limit",
  API_ERROR = "api_error",
  TIMEOUT = "timeout",
  VALIDATION_ERROR = "validation_error",
  NETWORK_ERROR = "network_error",
  UNKNOWN = "unknown",
}

/**
 * AI processing error with retry information
 */
export class AIProcessingError extends Error {
  constructor(
    message: string,
    public type: AIErrorType,
    public retryable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "AIProcessingError";
  }
}

/**
 * Wrapper service for AI agents with error handling and retry logic
 */
export class AgentWrapper {
  private static instance: AgentWrapper;

  private constructor() {}

  static getInstance(): AgentWrapper {
    if (!AgentWrapper.instance) {
      AgentWrapper.instance = new AgentWrapper();
    }
    return AgentWrapper.instance;
  }

  /**
   * Process a message with the AI processing agent
   */
  async processMessage(
    messageId: string,
    messageContent: {
      customerEmail?: string;
      customerName?: string;
      customerPhone?: string;
      channel: string;
      subject?: string;
      body: string;
      receivedAt: number;
    }
  ): Promise<Record<string, unknown>> {
    const maxRetries = config.processing.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Log attempt
        await this.logAttempt(
          messageId,
          "message_processing",
          attempt,
          maxRetries
        );

        // Create the prompt for the agent
        const prompt = `Analyze this customer message and extract structured business data:

FROM: ${
          messageContent.customerEmail ||
          messageContent.customerPhone ||
          "Unknown"
        } ${
          messageContent.customerName ? `(${messageContent.customerName})` : ""
        }
CHANNEL: ${messageContent.channel}
SUBJECT: ${messageContent.subject || "No subject"}
RECEIVED: ${new Date(messageContent.receivedAt).toISOString()}

MESSAGE BODY:
${messageContent.body}

Please analyze this message thoroughly and use the analyze-message tool to save the extracted data. Focus on:
1. Categorizing the business intent (quote request, order inquiry, etc.)
2. Extracting customer information and contact details
3. Identifying products, quantities, and specifications
4. Determining priority based on urgency keywords and deadlines
5. Extracting business context like vessel information and delivery requirements

Message ID to process: ${messageId}`;

        // Execute the agent (this would be done through Inngest in the actual implementation)
        // For now, we'll simulate the agent execution with proper error handling
        const result = await this.executeWithTimeout(
          () => this.simulateAgentExecution(messageId, prompt, "message"),
          30000 // 30 second timeout
        );

        // Log success
        await this.logSuccess(messageId, "message_processing", attempt);

        return result;
      } catch (error) {
        lastError = error as Error;
        const aiError = this.categorizeError(error as Error);

        // Log the error
        await this.logError(messageId, "message_processing", attempt, aiError);

        // Check if we should retry
        if (!aiError.retryable || attempt === maxRetries) {
          throw aiError;
        }

        // Wait before retry (exponential backoff)
        const delay = aiError.retryAfter || Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
      }
    }

    throw (
      lastError ||
      new AIProcessingError("Unknown error occurred", AIErrorType.UNKNOWN)
    );
  }

  /**
   * Process Excel data with the Excel parser agent
   */
  async processExcelData(
    messageId: string,
    excelData: string,
    filename?: string
  ): Promise<Record<string, unknown>> {
    const maxRetries = config.processing.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Log attempt
        await this.logAttempt(
          messageId,
          "excel_processing",
          attempt,
          maxRetries
        );

        // Create the prompt for the Excel parser agent
        const prompt = `Parse this Excel spreadsheet data and extract shipping item details:

FILENAME: ${filename || "Unknown"}
MESSAGE_ID: ${messageId}

EXCEL DATA:
${excelData}

Please analyze this Excel data thoroughly and use the parse-excel-attachment tool to save the extracted data. Focus on:
1. Extracting item names, quantities, and units
2. Identifying vessel information (name, arrival date, port)
3. Parsing product specifications and requirements
4. Converting data to SAP Business One compatible format
5. Calculating confidence scores based on data completeness

Message ID to process: ${messageId}`;

        // Execute the agent with timeout
        const result = await this.executeWithTimeout(
          () => this.simulateAgentExecution(messageId, prompt, "excel"),
          60000 // 60 second timeout for Excel processing
        );

        // Log success
        await this.logSuccess(messageId, "excel_processing", attempt);

        return result;
      } catch (error) {
        lastError = error as Error;
        const aiError = this.categorizeError(error as Error);

        // Log the error
        await this.logError(messageId, "excel_processing", attempt, aiError);

        // Check if we should retry
        if (!aiError.retryable || attempt === maxRetries) {
          throw aiError;
        }

        // Wait before retry (exponential backoff)
        const delay = aiError.retryAfter || Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
      }
    }

    throw (
      lastError ||
      new AIProcessingError("Unknown error occurred", AIErrorType.UNKNOWN)
    );
  }

  /**
   * Simulate agent execution (placeholder for actual agent integration)
   * This will be replaced with actual agent.run() calls when the integration is complete
   */
  private async simulateAgentExecution(
    messageId: string,
    prompt: string,
    type: "message" | "excel"
  ): Promise<Record<string, unknown>> {
    // Simulate processing time
    await this.sleep(1000 + Math.random() * 2000);

    // Simulate occasional failures for testing error handling
    if (Math.random() < 0.1) {
      // 10% failure rate for testing
      throw new Error("Simulated OpenAI API error");
    }

    // Return mock success result
    return {
      success: true,
      messageId,
      type,
      processed: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new AIProcessingError(
            "Operation timed out",
            AIErrorType.TIMEOUT,
            true
          )
        );
      }, timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Categorize errors for appropriate handling
   */
  private categorizeError(error: Error): AIProcessingError {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (message.includes("rate limit") || message.includes("429")) {
      return new AIProcessingError(
        "OpenAI API rate limit exceeded",
        AIErrorType.RATE_LIMIT,
        true,
        60000 // Retry after 1 minute
      );
    }

    // API errors
    if (
      message.includes("api") ||
      message.includes("400") ||
      message.includes("401") ||
      message.includes("403")
    ) {
      return new AIProcessingError(
        `OpenAI API error: ${error.message}`,
        AIErrorType.API_ERROR,
        false // Don't retry API errors
      );
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return new AIProcessingError(
        "Request timed out",
        AIErrorType.TIMEOUT,
        true,
        5000 // Retry after 5 seconds
      );
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("econnreset")
    ) {
      return new AIProcessingError(
        "Network error occurred",
        AIErrorType.NETWORK_ERROR,
        true,
        10000 // Retry after 10 seconds
      );
    }

    // Validation errors
    if (message.includes("validation") || message.includes("invalid")) {
      return new AIProcessingError(
        `Validation error: ${error.message}`,
        AIErrorType.VALIDATION_ERROR,
        false // Don't retry validation errors
      );
    }

    // Unknown errors - make them retryable with caution
    return new AIProcessingError(
      `Unknown error: ${error.message}`,
      AIErrorType.UNKNOWN,
      true,
      15000 // Retry after 15 seconds
    );
  }

  /**
   * Log processing attempt
   */
  private async logAttempt(
    messageId: string,
    operation: string,
    attempt: number,
    maxAttempts: number
  ): Promise<void> {
    try {
      await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `AI ${operation} attempt ${attempt}/${maxAttempts} for message ${messageId}`,
        source: "ai_agent_wrapper",
        data: {
          messageId,
          operation,
          attempt,
          maxAttempts,
        },
      });
    } catch (error) {
      console.error("Failed to log attempt:", error);
    }
  }

  /**
   * Log processing success
   */
  private async logSuccess(
    messageId: string,
    operation: string,
    attempt: number
  ): Promise<void> {
    try {
      await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `AI ${operation} succeeded for message ${messageId} on attempt ${attempt}`,
        source: "ai_agent_wrapper",
        data: {
          messageId,
          operation,
          attempt,
          success: true,
        },
      });
    } catch (error) {
      console.error("Failed to log success:", error);
    }
  }

  /**
   * Log processing error
   */
  private async logError(
    messageId: string,
    operation: string,
    attempt: number,
    error: AIProcessingError
  ): Promise<void> {
    try {
      await convex.mutation(api.systemLogs.create, {
        level: "error",
        message: `AI ${operation} failed for message ${messageId} on attempt ${attempt}: ${error.message}`,
        source: "ai_agent_wrapper",
        data: {
          messageId,
          operation,
          attempt,
          errorType: error.type,
          retryable: error.retryable,
          retryAfter: error.retryAfter,
          error: error.message,
        },
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate agent responses
   */
  validateAgentResponse(
    response: Record<string, unknown>,
    expectedType: "message" | "excel"
  ): boolean {
    if (!response || typeof response !== "object") {
      return false;
    }

    // Basic validation - can be enhanced based on actual response structure
    if (expectedType === "message") {
      return !!(response.success && response.messageId);
    }

    if (expectedType === "excel") {
      return !!(response.success && response.messageId);
    }

    return false;
  }
}

// Export singleton instance
export const agentWrapper = AgentWrapper.getInstance();
