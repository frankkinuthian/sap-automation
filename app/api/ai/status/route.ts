import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getAIConfig } from "@/lib/ai/config";

export async function GET(request: NextRequest) {
  try {
    const config = getAIConfig();

    // Test Inngest connectivity
    let inngestStatus = "unknown";
    let inngestError = null;

    try {
      // Try to send a test event to check connectivity
      const testResult = await inngest.send({
        name: "test/connectivity",
        data: { test: true },
      });
      inngestStatus = "connected";
    } catch (error) {
      inngestStatus = "disconnected";
      inngestError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json({
      success: true,
      status: {
        environment: process.env.NODE_ENV,
        openai: {
          configured: !!config.openai.apiKey,
          model: config.openai.model,
        },
        inngest: {
          status: inngestStatus,
          error: inngestError,
          devServerUrl:
            process.env.NODE_ENV === "development"
              ? "http://localhost:8288"
              : null,
        },
        processing: {
          batchSize: config.processing.batchSize,
          confidenceThreshold: config.processing.confidenceThreshold,
        },
      },
      recommendations:
        process.env.NODE_ENV === "development" &&
        inngestStatus === "disconnected"
          ? [
              "Start the Inngest dev server: npm run dev:inngest",
              "Or use: npm run dev:all to start both servers",
              "Visit http://localhost:8288 to monitor function executions",
            ]
          : [],
    });
  } catch (error) {
    console.error("Error checking AI status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
