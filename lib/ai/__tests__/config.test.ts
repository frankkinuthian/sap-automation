// Simple configuration test
// This will be expanded when we add proper testing framework

import { getAIConfig } from "../config";

// Mock environment variables for testing
const mockEnv = {
  OPENAI_API_KEY: "test-key",
  INNGEST_EVENT_KEY: "test-event-key",
  INNGEST_SIGNING_KEY: "test-signing-key",
};

// Test configuration loading
export function testConfigurationLoading() {
  try {
    // Set mock environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    const config = getAIConfig();

    console.log("✅ Configuration test passed:", {
      hasOpenAIKey: !!config.openai.apiKey,
      hasInngestKeys: !!(config.inngest.eventKey && config.inngest.signingKey),
      model: config.openai.model,
      batchSize: config.processing.batchSize,
    });

    return true;
  } catch (error) {
    console.error("❌ Configuration test failed:", error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testConfigurationLoading();
}
