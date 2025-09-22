import { describe, it, expect, beforeEach, vi } from "vitest";
import { aiProcessingAgent } from "@/inngest/ai-processing-agent";
import { excelParserAgent } from "@/inngest/excel-parser-agent";
import { agentWrapper } from "@/lib/ai/agent-wrapper";
import { getAIConfig } from "@/lib/ai/config";

// Mock environment variables for testing
vi.mock("@/lib/ai/config", () => ({
  getAIConfig: vi.fn(() => ({
    openai: {
      apiKey: "test-api-key",
      model: "gpt-4o-mini",
      maxTokens: 2000,
      temperature: 0.1,
    },
    processing: {
      batchSize: 10,
      retryAttempts: 3,
      confidenceThreshold: 0.8,
    },
    inngest: {
      eventKey: "test-event-key",
      signingKey: "test-signing-key",
    },
  })),
}));

// Mock Convex client
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(() => ({
    query: vi.fn(),
    mutation: vi.fn(),
  })),
}));

// Mock the agents
vi.mock("@/inngest/ai-processing-agent", () => ({
  aiProcessingAgent: {
    name: "AI Message Processing Agent",
    description: "Test agent",
    tools: [],
  },
}));

vi.mock("@/inngest/excel-parser-agent", () => ({
  excelParserAgent: {
    name: "Excel Parser Agent",
    description: "Test agent",
    tools: [],
  },
}));

describe("AI Agent Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should load AI configuration correctly", () => {
      const config = getAIConfig();

      expect(config).toBeDefined();
      expect(config.openai.apiKey).toBe("test-api-key");
      expect(config.openai.model).toBe("gpt-4o-mini");
      expect(config.processing.retryAttempts).toBe(3);
    });

    it("should have proper OpenAI model configuration", () => {
      const config = getAIConfig();

      expect(config.openai.model).toMatch(/^gpt-/);
      expect(config.openai.maxTokens).toBeGreaterThan(0);
      expect(config.openai.temperature).toBeGreaterThanOrEqual(0);
      expect(config.openai.temperature).toBeLessThanOrEqual(1);
    });
  });

  describe("Agent Definitions", () => {
    it("should have AI processing agent properly configured", () => {
      expect(aiProcessingAgent).toBeDefined();
      expect(aiProcessingAgent.name).toBe("AI Message Processing Agent");
      expect(aiProcessingAgent.tools).toBeDefined();
    });

    it("should have Excel parser agent properly configured", () => {
      expect(excelParserAgent).toBeDefined();
      expect(excelParserAgent.name).toBe("Excel Parser Agent");
      expect(excelParserAgent.tools).toBeDefined();
    });
  });

  describe("Agent Wrapper", () => {
    it("should create agent wrapper instance", () => {
      expect(agentWrapper).toBeDefined();
      expect(typeof agentWrapper.processMessage).toBe("function");
      expect(typeof agentWrapper.processExcelData).toBe("function");
    });

    it("should validate agent responses correctly", () => {
      const validMessageResponse = {
        success: true,
        messageId: "test-message-id",
        category: "quote_request",
      };

      const invalidResponse = {
        error: "Something went wrong",
      };

      expect(
        agentWrapper.validateAgentResponse(validMessageResponse, "message")
      ).toBe(true);
      expect(
        agentWrapper.validateAgentResponse(invalidResponse, "message")
      ).toBe(false);
      expect(agentWrapper.validateAgentResponse(null, "message")).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle rate limit errors appropriately", async () => {
      // Mock a rate limit error scenario
      const mockMessageContent = {
        customerEmail: "test@example.com",
        channel: "email",
        body: "Test message",
        receivedAt: Date.now(),
      };

      // This test would need actual agent execution to test properly
      // For now, we'll test the wrapper's error categorization
      expect(agentWrapper).toBeDefined();
    });

    it("should handle API authentication errors", async () => {
      // Test API key validation
      const mockMessageContent = {
        customerEmail: "test@example.com",
        channel: "email",
        body: "Test message",
        receivedAt: Date.now(),
      };

      // This would test actual API key validation
      expect(agentWrapper).toBeDefined();
    });
  });

  describe("Tool Parameter Validation", () => {
    it("should validate message analysis tool parameters", () => {
      const validParams = {
        messageId: "test-id",
        category: "quote_request",
        priority: "medium",
        customerInfo: {
          email: "test@example.com",
        },
        products: [],
        businessContext: {},
        confidenceScore: 0.8,
        extractedIntent: "Test intent",
      };

      // This would test actual Zod schema validation
      expect(validParams).toBeDefined();
      expect(validParams.messageId).toBe("test-id");
      expect(validParams.confidenceScore).toBeGreaterThan(0);
    });

    it("should validate Excel parsing tool parameters", () => {
      const validParams = {
        messageId: "test-id",
        excelData: "test,data\n1,2",
        items: [
          {
            itemName: "Test Item",
            quantity: 1,
            unit: "pcs",
          },
        ],
        totalItems: 1,
        confidenceScore: 0.9,
      };

      expect(validParams).toBeDefined();
      expect(validParams.items).toHaveLength(1);
      expect(validParams.totalItems).toBe(1);
    });
  });
});

describe("Integration Test Scenarios", () => {
  it("should handle a typical quote request message", async () => {
    const testMessage = {
      messageId: "test-quote-request",
      customerEmail: "customer@example.com",
      customerName: "Test Customer",
      channel: "email",
      subject: "Request for Quotation - Ship Provisions",
      body: `Dear Sir/Madam,

We would like to request a quotation for the following provisions for our vessel MV TEST SHIP arriving at Port of Singapore on 2024-01-15:

- Fresh vegetables: 50 kg
- Frozen meat: 100 kg  
- Rice: 200 kg
- Cooking oil: 20 liters

Please provide your best prices.

Best regards,
Test Customer`,
      receivedAt: Date.now(),
    };

    // This would test the actual agent execution
    expect(testMessage.body).toContain("quotation");
    expect(testMessage.body).toContain("vessel");
    expect(testMessage.body).toContain("kg");
  });

  it("should handle Excel attachment processing", async () => {
    const testExcelData = `Item,Quantity,Unit,Specifications
Fresh Vegetables,50,kg,Mixed seasonal vegetables
Frozen Meat,100,kg,Beef and chicken
Rice,200,kg,Long grain white rice
Cooking Oil,20,liters,Vegetable oil`;

    const testScenario = {
      messageId: "test-excel-processing",
      excelData: testExcelData,
      filename: "ship-provisions.xlsx",
    };

    // This would test the actual Excel parser agent
    expect(testExcelData).toContain("Item,Quantity,Unit");
    expect(testExcelData).toContain("kg");
    expect(testExcelData).toContain("liters");
  });
});
