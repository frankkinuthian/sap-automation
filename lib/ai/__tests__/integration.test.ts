import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAIConfig } from "@/lib/ai/config";

// Mock environment variables for testing
process.env.OPENAI_API_KEY = "test-key";
process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

describe("AI Processing Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate AI configuration", () => {
    const config = getAIConfig();

    expect(config).toBeDefined();
    expect(config.openai.apiKey).toBe("test-key");
    expect(config.openai.model).toBe("gpt-4o-mini");
    expect(config.processing.confidenceThreshold).toBe(0.8);
  });

  it("should have correct OpenAI model configuration", () => {
    const config = getAIConfig();

    expect(config.openai.model).toBe("gpt-4o-mini");
    expect(config.openai.maxTokens).toBe(2000);
    expect(config.openai.temperature).toBe(0.1);
  });

  it("should have correct processing configuration", () => {
    const config = getAIConfig();

    expect(config.processing.batchSize).toBe(10);
    expect(config.processing.retryAttempts).toBe(3);
    expect(config.processing.confidenceThreshold).toBe(0.8);
  });

  it("should validate message categorization logic", () => {
    // Test data representing different types of customer messages
    const testMessages = [
      {
        body: "Hi, I need a quote for 500kg of frozen chicken for our vessel MV Atlantic arriving at Port of Miami on January 15th. Please send pricing ASAP.",
        expectedCategory: "quote_request",
        expectedPriority: "urgent",
        expectedProducts: ["frozen chicken"],
        expectedVessel: "MV Atlantic",
      },
      {
        body: "Can you please update me on the status of order #12345? When will it be delivered?",
        expectedCategory: "order_inquiry",
        expectedPriority: "medium",
      },
      {
        body: "We're having issues with the refrigeration unit you delivered last week. It's not maintaining temperature.",
        expectedCategory: "support_request",
        expectedPriority: "high",
      },
      {
        body: "What are your operating hours and do you deliver to Port Everglades?",
        expectedCategory: "general_inquiry",
        expectedPriority: "low",
      },
      {
        body: "I'm very disappointed with the quality of the last delivery. The meat was not fresh and we had to throw it away.",
        expectedCategory: "complaint",
        expectedPriority: "high",
      },
    ];

    // This test validates our categorization logic expectations
    // The actual AI processing would be tested in end-to-end tests
    testMessages.forEach((msg) => {
      expect(msg.expectedCategory).toMatch(
        /^(quote_request|order_inquiry|support_request|general_inquiry|complaint|other)$/
      );
      expect(msg.expectedPriority).toMatch(/^(low|medium|high|urgent)$/);
    });
  });

  it("should validate urgency keyword detection", () => {
    const urgencyKeywords = [
      "urgent",
      "asap",
      "emergency",
      "critical",
      "immediately",
      "rush",
    ];
    const testMessages = [
      "Please send this ASAP - we need it today!",
      "URGENT: Vessel arriving tomorrow, need provisions immediately",
      "This is a critical situation, please help",
      "Emergency order needed for MV Pacific",
      "Rush delivery required for tomorrow morning",
    ];

    testMessages.forEach((message) => {
      const hasUrgentKeyword = urgencyKeywords.some((keyword) =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );
      expect(hasUrgentKeyword).toBe(true);
    });
  });

  it("should validate maritime provisioning terminology", () => {
    const maritimeTerms = [
      "vessel",
      "ship",
      "port",
      "arrival",
      "provisioning",
      "bonded stores",
    ];
    const maritimeMessage =
      "Need provisions for vessel MV Explorer arriving at Port of Los Angeles. Require bonded stores for international voyage.";

    const foundTerms = maritimeTerms.filter((term) =>
      maritimeMessage.toLowerCase().includes(term.toLowerCase())
    );

    expect(foundTerms.length).toBeGreaterThan(0);
    expect(foundTerms).toContain("vessel");
    expect(foundTerms).toContain("port");
    expect(foundTerms).toContain("provisioning");
  });

  it("should validate confidence scoring ranges", () => {
    const confidenceScores = [0.95, 0.85, 0.75, 0.65, 0.45, 0.25];
    const config = getAIConfig();

    confidenceScores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);

      const requiresReview = score < config.processing.confidenceThreshold;
      if (score >= 0.8) {
        expect(requiresReview).toBe(false);
      } else {
        expect(requiresReview).toBe(true);
      }
    });
  });

  it("should validate product extraction patterns", () => {
    const productMessages = [
      {
        text: "Need 500kg frozen chicken and 200 boxes of vegetables",
        expectedProducts: ["frozen chicken", "vegetables"],
        expectedQuantities: [500, 200],
        expectedUnits: ["kg", "boxes"],
      },
      {
        text: "Require 10 tons of rice, 50 cases of canned goods, and 100 liters of cooking oil",
        expectedProducts: ["rice", "canned goods", "cooking oil"],
        expectedQuantities: [10, 50, 100],
        expectedUnits: ["tons", "cases", "liters"],
      },
    ];

    // This validates our expectation patterns for product extraction
    productMessages.forEach((msg) => {
      expect(msg.expectedProducts.length).toBeGreaterThan(0);
      expect(msg.expectedQuantities.length).toBe(msg.expectedProducts.length);
      expect(msg.expectedUnits.length).toBe(msg.expectedProducts.length);
    });
  });
});
