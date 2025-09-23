import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import convex from "@/lib/convexClient";
import { api } from "@/convex/_generated/api";
import { getAIConfig } from "@/lib/ai/config";

export async function POST(request: NextRequest) {
  try {
    // console.log("🔵 AI Process API called");
    // Validate configuration first
    getAIConfig(); // Validate configuration
    // console.log("🟢 AI Processing API - Configuration validated");

    const {
      messageIds,
      batchSize = 10,
      priority = "medium",
      processAll = false,
      processAttachments = false,
    } = await request.json();

    // console.log("🔵 Request data:", {
    //   messageIds,
    //   batchSize,
    //   priority,
    //   processAll,
    // });

    let messagesToProcess = messageIds;

    // If processAll is true, trigger the process-all-received function
    if (processAll) {
      const eventResult = await inngest.send({
        name: "ai/process.all-received",
        data: {
          batchSize,
          maxMessages: 100, // Limit to prevent overwhelming the system
        },
      });

      return NextResponse.json({
        success: true,
        message: "Triggered processing of all received messages",
        eventsTriggered: 1,
        eventIds: eventResult.ids,
      });
    }

    // If processAttachments is true, process messages with Excel attachments
    if (processAttachments) {
      const messagesWithExcel = await convex.query(
        api.messages.getMessagesWithExcelAttachments,
        {
          processed: false,
          limit: 50,
        }
      );

      if (messagesWithExcel.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No messages with unprocessed Excel attachments found",
          eventsTriggered: 0,
        });
      }

      const events = [];
      for (const message of messagesWithExcel) {
        const excelAttachments =
          message.attachmentMetadata?.filter(
            (att) => att.isExcel && !att.processed
          ) || [];

        for (const attachment of excelAttachments) {
          const eventResult = await inngest.send({
            name: "ai/process.excel-attachment",
            data: {
              messageId: message._id,
              attachmentId: attachment.attachmentId,
              filename: attachment.filename,
            },
          });
          events.push(...eventResult.ids);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Triggered Excel processing for ${events.length} attachments`,
        eventsTriggered: events.length,
        eventIds: events,
      });
    }

    // If no specific messages provided, get all received messages
    if (!messagesToProcess) {
      const receivedMessages = await convex.query(api.messages.getByStatus, {
        status: "received",
      });
      messagesToProcess = receivedMessages.map((m) => m._id);
    }

    if (messagesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No messages to process",
        eventsTriggered: 0,
      });
    }

    // Trigger batch processing
    try {
      // console.log(
      //   "🟡 Sending Inngest event ai/process.batch with messageIds:",
      //   messagesToProcess
      // );
      const eventResult = await inngest.send({
        name: "ai/process.batch",
        data: {
          messageIds: messagesToProcess,
          batchSize,
          priority,
        },
      });
      // console.log(
      //   "🟢 Inngest event sent successfully, eventIds:",
      //   eventResult.ids
      // );

      return NextResponse.json({
        success: true,
        eventsTriggered: 1,
        eventIds: eventResult.ids,
        messagesToProcess: messagesToProcess.length,
        message: `Triggered AI processing for ${messagesToProcess.length} messages`,
      });
    } catch (inngestError) {
      // In development, if Inngest dev server is not running, provide helpful message
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Inngest dev server not running. Please run: npm run dev:inngest"
        );
        return NextResponse.json(
          {
            success: false,
            error: "Inngest dev server not running",
            message:
              "Please start the Inngest dev server by running 'npm run dev:inngest' in a separate terminal, or use 'npm run dev:all' to start both servers.",
            messagesToProcess: messagesToProcess.length,
          },
          { status: 503 }
        );
      }
      throw inngestError;
    }
  } catch (error) {
    console.error("Error in AI processing API:", error);

    // Check if it's a configuration error
    if (
      error instanceof Error &&
      error.message.includes("Missing required environment variables")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuration error",
          details: error.message,
          message: "Please check your environment variables configuration",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  try {
    const config = getAIConfig();

    return NextResponse.json({
      success: true,
      message: "AI Processing API is ready",
      configuration: {
        model: config.openai.model,
        batchSize: config.processing.batchSize,
        confidenceThreshold: config.processing.confidenceThreshold,
        hasOpenAIKey: !!config.openai.apiKey,
        hasInngestKeys: !!(
          config.inngest.eventKey && config.inngest.signingKey
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Configuration error",
      },
      { status: 500 }
    );
  }
}
