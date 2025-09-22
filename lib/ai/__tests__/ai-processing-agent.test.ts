import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiProcessingAgent } from "@/inngest/ai-processing-agent";

// Mock the Convex client
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(() => ({
    mutation: vi.fn(),
    query: vi.fn(),
  })),
}));

// Mock the AI config
vi.mock("@/lib/ai/config", () => ({
  getAIConfig: vi.fn(() => ({
    openai: {
      apiKey: "test-key",
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

// Mock environment variables
process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

describe("AI Processing Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined and have correct properties", () => {
    expect(aiProcessingAgent).toBeDefined();
    expect(aiProcessingAgent.name).toBe("AI Message Processing Agent");
    expect(aiProcessingAgent.description).toContain(
      "analyzing customer messages"
    );
    expect(aiProcessingAgent.tools).toHaveLength(1);
  });

  it("should have tools defined", () => {
    expect(aiProcessingAgent.tools).toBeDefined();
    // Note: Tool structure may vary in test environment due to mocking
    // The actual tool functionality will be tested in integration tests
  });

  it("should have correct system prompt for maritime provisioning", () => {
    const systemPrompt = aiProcessingAgent.system;

    // Check for key maritime-specific terms
    expect(systemPrompt).toContain("vessel");
    expect(systemPrompt).toContain("provisioning");
    expect(systemPrompt).toContain("SAP Business One");
    expect(systemPrompt).toContain("quote_request");
    expect(systemPrompt).toContain("urgent");
  });

  it("should include all required message categories", () => {
    const systemPrompt = aiProcessingAgent.system;

    const requiredCategories = [
      "quote_request",
      "order_inquiry",
      "support_request",
      "general_inquiry",
      "complaint",
      "other",
    ];

    requiredCategories.forEach((category) => {
      expect(systemPrompt).toContain(category);
    });
  });

  it("should include priority levels in system prompt", () => {
    const systemPrompt = aiProcessingAgent.system;

    const priorityLevels = ["urgent", "high", "medium", "low"];
    priorityLevels.forEach((priority) => {
      expect(systemPrompt).toContain(priority);
    });
  });

  it("should include urgency keywords in system prompt", () => {
    const systemPrompt = aiProcessingAgent.system;

    const urgencyKeywords = [
      "urgent",
      "asap",
      "emergency",
      "critical",
      "immediately",
    ];
    urgencyKeywords.forEach((keyword) => {
      expect(systemPrompt).toContain(keyword);
    });
  });

  it("should include confidence scoring guidelines", () => {
    const systemPrompt = aiProcessingAgent.system;

    expect(systemPrompt).toContain("CONFIDENCE SCORING");
    expect(systemPrompt).toContain("0.9-1.0");
    expect(systemPrompt).toContain("0.7-0.8");
    expect(systemPrompt).toContain("0.5-0.6");
  });
});
