interface AIConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  processing: {
    batchSize: number;
    retryAttempts: number;
    confidenceThreshold: number;
  };
  inngest: {
    eventKey: string;
    signingKey: string;
  };
}

export const getAIConfig = (): AIConfig => {
  // In development, only OpenAI key is strictly required
  // Inngest keys can be dummy values for local development
  const isDevelopment = process.env.NODE_ENV === "development";

  const requiredEnvVars = ["OPENAI_API_KEY"];

  // Only require Inngest keys in production
  if (!isDevelopment) {
    requiredEnvVars.push("INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY");
  }

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  // Debug: Log environment variable status (without exposing values)
  console.log("AI Config - Environment check:", {
    NODE_ENV: process.env.NODE_ENV,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || "none",
  });

  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "500"),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.1"),
    },
    processing: {
      batchSize: parseInt(process.env.AI_BATCH_SIZE || "10"),
      retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || "3"),
      confidenceThreshold: parseFloat(
        process.env.AI_CONFIDENCE_THRESHOLD || "0.8"
      ),
    },
    inngest: {
      eventKey: process.env.INNGEST_EVENT_KEY || "local-dev-key",
      signingKey: process.env.INNGEST_SIGNING_KEY || "local-dev-signing-key",
    },
  };
};

// Validate configuration on module load in development
if (process.env.NODE_ENV === "development") {
  try {
    getAIConfig();
    console.log("✅ AI configuration validated successfully");
  } catch (error) {
    console.error("❌ AI configuration validation failed:", error);
  }
}
