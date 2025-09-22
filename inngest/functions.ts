import { inngest } from "./client";
// import { aiProcessingAgent } from "./ai-processing-agent"; // Not used with direct OpenAI service
import { excelParserAgent } from "./excel-parser-agent";
import { excelProcessor } from "@/lib/files/excel-processor";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getAIConfig } from "@/lib/ai/config";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Get AI configuration
const config = getAIConfig();

// Helper function to handle OpenAI API errors consistently
async function handleOpenAIError(
  error: unknown,
  messageId: string,
  operation: string
): Promise<never> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Log the specific error
  await convex.mutation(api.systemLogs.create, {
    level: "error",
    message: `OpenAI API error during ${operation} for ${messageId}: ${errorMessage}`,
    source: "ai_processing",
    data: {
      messageId,
      error: errorMessage,
      errorType: "openai_api_error",
      operation,
      timestamp: Date.now(),
    },
  });

  // Check if it's a rate limit error (429 or rate limit in message)
  if (
    errorMessage.toLowerCase().includes("rate limit") ||
    errorMessage.includes("429") ||
    errorMessage.toLowerCase().includes("quota exceeded")
  ) {
    // For rate limit errors, we'll let Inngest handle the retry with exponential backoff
    throw new Error(`OpenAI rate limit exceeded: ${errorMessage}`);
  }

  // Check if it's an API key error (401 or unauthorized)
  if (
    errorMessage.includes("401") ||
    errorMessage.toLowerCase().includes("unauthorized") ||
    errorMessage.toLowerCase().includes("invalid api key")
  ) {
    // Don't retry API key errors - mark as failed immediately
    await convex.mutation(api.messages.updateStatus, {
      messageId: messageId as Id<"messages">,
      status: "failed",
      processedAt: Date.now(),
    });
    throw new Error(`OpenAI API authentication failed: ${errorMessage}`);
  }

  // Check if it's a model/context error (400 or context length)
  if (
    errorMessage.includes("400") ||
    errorMessage.toLowerCase().includes("context length") ||
    errorMessage.toLowerCase().includes("maximum context")
  ) {
    // For context length errors, mark as failed (don't retry)
    await convex.mutation(api.messages.updateStatus, {
      messageId: messageId as Id<"messages">,
      status: "failed",
      processedAt: Date.now(),
    });
    throw new Error(`OpenAI context/model error: ${errorMessage}`);
  }

  // Check if it's a network/timeout error
  if (
    errorMessage.toLowerCase().includes("timeout") ||
    errorMessage.toLowerCase().includes("network") ||
    errorMessage.toLowerCase().includes("connection")
  ) {
    // For network errors, allow retry
    throw new Error(`OpenAI network error: ${errorMessage}`);
  }

  // For other errors, rethrow to trigger Inngest retry
  throw new Error(`OpenAI API error: ${errorMessage}`);
}

// Function to process a single message with AI
export const processMessage = inngest.createFunction(
  {
    id: "ai-process-message",
    retries: 3,
    onFailure: async ({ event, error }) => {
      try {
        const messageId = (event as { data?: { messageId?: string } }).data
          ?.messageId;
        if (messageId) {
          // Handle final failure - update message status
          await convex.mutation(api.messages.updateStatus, {
            messageId: messageId as Id<"messages">,
            status: "failed",
            processedAt: Date.now(),
          });

          // Log the final failure
          await convex.mutation(api.systemLogs.create, {
            level: "error",
            message: `AI processing failed permanently for message ${messageId}: ${error.message}`,
            source: "ai_processing",
            data: {
              messageId,
              error: error.message,
              stack: error.stack,
              retryCount: 3,
            },
          });
        }
      } catch (cleanupError) {
        console.error("Failed to handle processing failure:", cleanupError);
      }
    },
  },
  { event: "ai/process.message" },
  async ({ event, step }) => {
    const { messageId } = event.data;
    // console.log(
    //   "🟡 Inngest processMessage function started for messageId:",
    //   messageId
    // );

    // Validate messageId
    if (!messageId || typeof messageId !== "string") {
      // console.log("🔴 Invalid messageId provided:", messageId);
      throw new Error("Invalid messageId provided in event data");
    }
    // console.log("🟢 MessageId validation passed:", messageId);

    // Get message from database
    const message = await step.run("get-message", async () => {
      // console.log("🟡 Fetching message from database:", messageId);
      const msg = await convex.query(api.messages.getById, {
        id: messageId as Id<"messages">,
      });

      if (!msg) {
        // console.log("🔴 Message not found in database:", messageId);
        throw new Error(`Message ${messageId} not found in database`);
      }

      // console.log("🟢 Message found, status:", msg.status);
      return msg;
    });

    // Check if message is in correct status for processing
    // console.log(
    //   "🟡 Checking message status:",
    //   message.status,
    //   "expected: received"
    // );
    if (message.status !== "received" && message.status !== "processing") {
      // console.log(
      //   "🔴 Skipping processing - message status is",
      //   message.status,
      //   "not 'received'"
      // );
      await step.run("log-skip", async () => {
        return await convex.mutation(api.systemLogs.create, {
          level: "info",
          message: `Skipping AI processing for message ${messageId} - status is ${message.status}, expected 'received'`,
          source: "ai_processing",
          data: { messageId, currentStatus: message.status },
        });
      });

      return {
        success: false,
        reason: "Message not in 'received' status",
        messageId,
        currentStatus: message.status,
      };
    }
    // console.log("🟢 Message status check passed - proceeding with processing");

    // Update status to processing
    await step.run("update-status-processing", async () => {
      return await convex.mutation(api.messages.updateStatus, {
        messageId: messageId as Id<"messages">,
        status: "processing",
        processedAt: Date.now(),
      });
    });

    // Log processing start
    await step.run("log-processing-start", async () => {
      return await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `Starting AI processing for message ${messageId}`,
        source: "ai_processing",
        data: {
          messageId,
          customerEmail: message.customerEmail,
          customerName: message.customerName,
          channel: message.channel,
          bodyLength: message.body?.length || 0,
        },
      });
    });

    // Run the AI processing agent with actual OpenAI integration and error handling
    const result = await step.run("process-with-direct-openai", async () => {
      try {
        // console.log(
        //   "🤖 Starting direct OpenAI analysis for message:",
        //   messageId
        // );

        // Import the direct OpenAI service
        // console.log("🟡 Importing direct OpenAI service...");
        const { analyzeMessageWithOpenAI } = await import(
          "@/lib/ai/direct-openai-service"
        );
        // console.log("🟢 Direct OpenAI service imported successfully");

        // console.log("🟡 Calling analyzeMessageWithOpenAI...");
        const analysisResult = await analyzeMessageWithOpenAI(
          messageId,
          message.body || "",
          message.customerEmail || "",
          message.customerName,
          message.subject
        );
        // console.log("🟢 Analysis result received:", analysisResult.success);

        if (analysisResult.success) {
          // Save the analysis results to the database
          await convex.mutation(api.messages.updateStatus, {
            messageId: messageId as Id<"messages">,
            status: "parsed",
            processedAt: Date.now(),
            aiParsedData: {
              processedAt: Date.now(),
              processingVersion: "1.0",
              aiModel: config.openai.model,
              confidenceScore: analysisResult.confidenceScore,
              category: analysisResult.category,
              intent: analysisResult.extractedData.intent,
              priority: analysisResult.priority,
              customer: analysisResult.extractedData.customer,
              products: analysisResult.extractedData.products,
              businessContext: analysisResult.extractedData.businessContext,
              flags: analysisResult.extractedData.flags,
              urgencyKeywords: analysisResult.extractedData.urgencyKeywords,
              rawResponses: {
                openai: {
                  model: config.openai.model,
                  timestamp: Date.now(),
                  result: analysisResult,
                },
              },
            },
          });

          // console.log(
          //   "✅ Direct OpenAI analysis completed and saved successfully"
          // );
        }

        return analysisResult;
      } catch (error) {
        console.error("🔴 Direct OpenAI analysis failed:", error);
        console.error("🔴 Error details:", {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        await handleOpenAIError(error, messageId, "message processing");
      }
    });

    return {
      success: true,
      messageId,
      result,
    };
  }
);

// Function to process multiple messages in batch
export const processBatch = inngest.createFunction(
  {
    id: "ai-process-batch",
    retries: 2,
  },
  { event: "ai/process.batch" },
  async ({ event, step }) => {
    const { messageIds, batchSize = 5, priority = "medium" } = event.data;
    // console.log("🟡 Batch processor started with messageIds:", messageIds);

    // Validate input
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      // console.log("🔴 Invalid messageIds array:", messageIds);
      throw new Error("messageIds must be a non-empty array");
    }

    // Log batch processing start
    await step.run("log-batch-start", async () => {
      return await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `Starting batch AI processing for ${messageIds.length} messages`,
        source: "ai_processing",
        data: {
          messageCount: messageIds.length,
          batchSize,
          priority,
        },
      });
    });

    // Process messages in batches to avoid overwhelming the system
    const batches = [];
    for (let i = 0; i < messageIds.length; i += batchSize) {
      batches.push(messageIds.slice(i, i + batchSize));
    }

    const results: Array<{
      messageId: string;
      success: boolean;
      eventId?: string;
      error?: string;
    }> = [];
    let processedCount = 0;
    let failedCount = 0;

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      const batchResults = await step.run(
        `process-batch-${batchIndex}`,
        async () => {
          const batchPromises = batch.map(async (messageId) => {
            try {
              // console.log(
              //   "🟡 Sending ai/process.message event for:",
              //   messageId
              // );
              const eventResult = await inngest.send({
                name: "ai/process.message",
                data: { messageId },
              });
              // console.log(
              //   "🟢 Event sent for messageId:",
              //   messageId,
              //   "eventId:",
              //   eventResult.ids[0]
              // );
              return { messageId, success: true, eventId: eventResult.ids[0] };
            } catch (error) {
              // console.log(
              //   "🔴 Failed to send event for messageId:",
              //   messageId,
              //   error
              // );
              return {
                messageId,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          });

          return await Promise.all(batchPromises);
        }
      );

      // Count results
      batchResults.forEach((result) => {
        if (result.success) {
          processedCount++;
        } else {
          failedCount++;
        }
      });

      results.push(...batchResults);

      // Add delay between batches to prevent overwhelming the system
      if (batchIndex < batches.length - 1) {
        await step.sleep("batch-delay", "2s");
      }
    }

    // Log batch completion
    await step.run("log-batch-completion", async () => {
      return await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `Batch AI processing completed: ${processedCount} triggered, ${failedCount} failed`,
        source: "ai_processing",
        data: {
          totalMessages: messageIds.length,
          processedCount,
          failedCount,
          batchCount: batches.length,
          results: results.filter((r) => !r.success), // Only log failed ones
        },
      });
    });

    return {
      success: true,
      totalMessages: messageIds.length,
      processedCount,
      failedCount,
      batchCount: batches.length,
      results,
    };
  }
);

// Function to process all received messages
export const processAllReceived = inngest.createFunction(
  {
    id: "ai-process-all-received",
    retries: 1,
  },
  { event: "ai/process.all-received" },
  async ({ event, step }) => {
    const { batchSize = 10, maxMessages = 100 } = event.data || {};

    // Get all messages with status "received"
    const receivedMessages = await step.run(
      "get-received-messages",
      async () => {
        const messages = await convex.query(api.messages.getByStatus, {
          status: "received",
        });

        // Limit the number of messages to process
        return messages.slice(0, maxMessages);
      }
    );

    if (receivedMessages.length === 0) {
      await step.run("log-no-messages", async () => {
        return await convex.mutation(api.systemLogs.create, {
          level: "info",
          message: "No messages with status 'received' found for AI processing",
          source: "ai_processing",
          data: { maxMessages },
        });
      });

      return {
        success: true,
        message: "No messages to process",
        processedCount: 0,
      };
    }

    // Extract message IDs
    const messageIds = receivedMessages.map((msg) => msg._id);

    // Trigger batch processing
    const batchResult = await step.run("trigger-batch-processing", async () => {
      return await inngest.send({
        name: "ai/process.batch",
        data: {
          messageIds,
          batchSize,
          priority: "medium",
        },
      });
    });

    return {
      success: true,
      messagesFound: receivedMessages.length,
      batchEventId: batchResult.ids[0],
      messageIds,
    };
  }
);

// Function to process Excel attachments from file path
export const processExcelAttachment = inngest.createFunction(
  {
    id: "ai-process-excel-attachment",
    retries: 3,
    onFailure: async ({ event, error }) => {
      try {
        const messageId = (event as { data?: { messageId?: string } }).data
          ?.messageId;
        if (messageId) {
          // Handle final failure - update message status
          await convex.mutation(api.messages.updateStatus, {
            messageId: messageId as Id<"messages">,
            status: "failed",
            processedAt: Date.now(),
          });

          // Log the final failure
          await convex.mutation(api.systemLogs.create, {
            level: "error",
            message: `Excel processing failed permanently for message ${messageId}: ${error.message}`,
            source: "excel_processing",
            data: {
              messageId,
              error: error.message,
              stack: error.stack,
              retryCount: 3,
            },
          });
        }
      } catch (cleanupError) {
        console.error(
          "Failed to handle Excel processing failure:",
          cleanupError
        );
      }
    },
  },
  { event: "ai/process.excel" },
  async ({ event, step }) => {
    const { messageId, filePath, fileBuffer, filename } = event.data;

    // Validate input
    if (!messageId || typeof messageId !== "string") {
      throw new Error("Invalid messageId provided in event data");
    }

    if (!filePath && !fileBuffer) {
      throw new Error("Either filePath or fileBuffer must be provided");
    }

    // Get message from database
    const message = await step.run("get-message", async () => {
      const msg = await convex.query(api.messages.getById, {
        id: messageId as Id<"messages">,
      });

      if (!msg) {
        throw new Error(`Message ${messageId} not found in database`);
      }

      return msg;
    });

    // Extract Excel content
    const excelData = await step.run("extract-excel-content", async () => {
      try {
        if (fileBuffer) {
          // Process from buffer (for uploaded files)
          const buffer = Buffer.from(fileBuffer, "base64");
          return await excelProcessor.extractExcelContentFromBuffer(
            buffer,
            filename
          );
        } else if (filePath) {
          // Process from file path
          return await excelProcessor.extractExcelContent(filePath);
        } else {
          throw new Error("No file data provided");
        }
      } catch (error) {
        throw new Error(
          `Failed to extract Excel content: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    });

    // Validate Excel format
    const isValidFormat = await step.run("validate-excel-format", async () => {
      const isValid = excelProcessor.validateExcelFormat(excelData);

      if (!isValid) {
        await convex.mutation(api.systemLogs.create, {
          level: "warning",
          message: `Excel file may not contain shipping data for message ${messageId}`,
          source: "excel_processing",
          data: {
            messageId,
            filename: filename || filePath,
            reason:
              "Failed validation - may not contain shipping/provisioning data",
          },
        });
      }

      return isValid;
    });

    // Log Excel processing start
    await step.run("log-excel-processing-start", async () => {
      return await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `Starting Excel processing for message ${messageId}`,
        source: "excel_processing",
        data: {
          messageId,
          customerEmail: message.customerEmail,
          filename: filename || filePath,
          excelDataLength: excelData.length,
          isValidFormat,
        },
      });
    });

    // Process Excel data using the Excel Parser Agent
    const result = await step.run("process-excel-with-ai-agent", async () => {
      try {
        return await excelParserAgent.run(`Parse this Excel spreadsheet data for maritime provisioning items:

CUSTOMER: ${message.customerEmail} ${
          message.customerName ? `(${message.customerName})` : ""
        }
FILENAME: ${filename || filePath || "Unknown"}
VALID_FORMAT: ${isValidFormat}

EXCEL DATA:
${excelData}

Please analyze this Excel data thoroughly and use the parse-excel-attachment tool to save the extracted data. Focus on:
1. Extracting all shipping items with quantities, units, and specifications
2. Identifying vessel information (name, arrival date, port)
3. Converting data to SAP Business One compatible format
4. Calculating confidence scores based on data completeness
5. Handling maritime-specific terminology and units

Message ID to process: ${messageId}`);
      } catch (error) {
        await handleOpenAIError(error, messageId, "Excel processing");
      }
    });

    return {
      success: true,
      messageId,
      filename: filename || filePath,
      isValidFormat,
      result,
    };
  }
);

// Function to process Excel attachments from raw data
export const processExcelData = inngest.createFunction(
  {
    id: "ai-process-excel-data",
    retries: 3,
    onFailure: async ({ event, error }) => {
      try {
        const messageId = (event as { data?: { messageId?: string } }).data
          ?.messageId;
        if (messageId) {
          // Handle final failure - update message status
          await convex.mutation(api.messages.updateStatus, {
            messageId: messageId as Id<"messages">,
            status: "failed",
            processedAt: Date.now(),
          });

          // Log the final failure
          await convex.mutation(api.systemLogs.create, {
            level: "error",
            message: `Excel data processing failed permanently for message ${messageId}: ${error.message}`,
            source: "excel_processing",
            data: {
              messageId,
              error: error.message,
              stack: error.stack,
              retryCount: 3,
            },
          });
        }
      } catch (cleanupError) {
        console.error(
          "Failed to handle Excel data processing failure:",
          cleanupError
        );
      }
    },
  },
  { event: "ai/process.excel-data" },
  async ({ event, step }) => {
    const { messageId, excelData, filename } = event.data;

    // Validate input
    if (!messageId || typeof messageId !== "string") {
      throw new Error("Invalid messageId provided in event data");
    }

    if (!excelData || typeof excelData !== "string") {
      throw new Error("Invalid excelData provided in event data");
    }

    // Get message from database
    const message = await step.run("get-message", async () => {
      const msg = await convex.query(api.messages.getById, {
        id: messageId as Id<"messages">,
      });

      if (!msg) {
        throw new Error(`Message ${messageId} not found in database`);
      }

      return msg;
    });

    // Validate Excel format
    const isValidFormat = await step.run("validate-excel-format", async () => {
      return excelProcessor.validateExcelFormat(excelData);
    });

    // Log Excel processing start
    await step.run("log-excel-processing-start", async () => {
      return await convex.mutation(api.systemLogs.create, {
        level: "info",
        message: `Starting Excel data processing for message ${messageId}`,
        source: "excel_processing",
        data: {
          messageId,
          customerEmail: message.customerEmail,
          filename: filename || "Unknown",
          excelDataLength: excelData.length,
          isValidFormat,
        },
      });
    });

    // Process Excel data using the Excel Parser Agent
    // Process Excel data using the Excel Parser Agent
    const result = await step.run(
      "process-excel-data-with-ai-agent",
      async () => {
        try {
          return await excelParserAgent.run(`Parse this Excel spreadsheet data for maritime provisioning items:

CUSTOMER: ${message.customerEmail} ${
            message.customerName ? `(${message.customerName})` : ""
          }
FILENAME: ${filename || "Unknown"}
VALID_FORMAT: ${isValidFormat}

EXCEL DATA:
${excelData}

Please analyze this Excel data thoroughly and use the parse-excel-attachment tool to save the extracted data. Focus on:
1. Extracting all shipping items with quantities, units, and specifications
2. Identifying vessel information (name, arrival date, port)
3. Converting data to SAP Business One compatible format
4. Calculating confidence scores based on data completeness
5. Handling maritime-specific terminology and units

Message ID to process: ${messageId}`);
        } catch (error) {
          await handleOpenAIError(error, messageId, "Excel data processing");
        }
      }
    );

    return {
      success: true,
      messageId,
      filename: filename || "Unknown",
      isValidFormat,
      result,
    };
  }
);

// Export all functions for registration
export const functions = [
  processMessage,
  processBatch,
  processAllReceived,
  processExcelAttachment,
  processExcelData,
];
