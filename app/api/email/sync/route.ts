import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { GmailOAuthClient } from "../../../../lib/email/gmail-oauth-client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  try {
    console.log("Starting Gmail sync...");

    const gmailClient = new GmailOAuthClient();

    // Check if authenticated
    const isAuthenticated = await gmailClient.isAuthenticated();
    console.log("Authentication status:", isAuthenticated);

    if (!isAuthenticated) {
      console.log("User not authenticated, returning 401");
      return NextResponse.json(
        {
          error: "Not authenticated",
          message:
            "Please visit /api/auth/gmail to authenticate with Gmail first",
          authUrl: "/api/auth/gmail",
        },
        { status: 401 }
      );
    }

    console.log("Fetching unread messages from Gmail...");
    const messages = await gmailClient.getUnreadMessages();

    console.log(`Found ${messages.length} unread emails to process`);

    if (messages.length > 0) {
      console.log("Sample message preview:", {
        messageId: messages[0].messageId,
        from: messages[0].customerEmail,
        subject: messages[0].subject,
        bodyPreview: messages[0].body.substring(0, 100) + "...",
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const message of messages) {
      try {
        // Store message in Convex
        const messageId = await convex.mutation(api.messages.create, {
          messageId: message.messageId,
          channel: message.channel,
          customerEmail: message.customerEmail,
          customerName: message.customerName,
          subject: message.subject,
          body: message.body,
          status: "received",
          receivedAt: message.receivedAt,
          attachmentMetadata: message.attachmentMetadata,
        });

        console.log(`Stored message ${message.messageId} with ID ${messageId}`);
        successCount++;

        // Optionally mark as read after successful processing
        // await gmailClient.markAsRead(message.messageId);
      } catch (error) {
        const errorMsg = `Error processing message ${message.messageId}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(errorMsg);
        errors.push(errorMsg);
        errorCount++;
      }
    }

    // Log the sync operation to system logs
    try {
      await convex.mutation(api.systemLogs.create, {
        level: errorCount > 0 ? "warning" : "info",
        message: `Gmail sync completed: ${successCount} success, ${errorCount} errors`,
        source: "gmail_oauth_sync",
        data: {
          totalMessages: messages.length,
          successCount,
          errorCount,
          errors: errors.slice(0, 5), // Limit error details
        },
      });
    } catch (logError) {
      console.error("Failed to log sync operation:", logError);
    }

    const response = {
      success: errorCount === 0,
      totalMessages: messages.length,
      successCount,
      errorCount,
      message:
        errorCount === 0
          ? `Successfully processed ${successCount} messages`
          : `Processed ${successCount} messages successfully, ${errorCount} errors occurred`,
      errors: errorCount > 0 ? errors : undefined,
    };

    return NextResponse.json(response, {
      status: errorCount === 0 ? 200 : 207, // 207 = Multi-Status (partial success)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Gmail sync error:", error);

    // If it's an authentication error, provide auth URL
    if (error instanceof Error && error.message.includes("Not authenticated")) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: "Please authenticate with Gmail first",
          authUrl: "/api/auth/gmail",
        },
        { status: 401 }
      );
    }

    // Log the error to system logs if possible
    try {
      await convex.mutation(api.systemLogs.create, {
        level: "error",
        message: `Gmail sync failed: ${errorMessage}`,
        source: "gmail_oauth_sync",
        data: { error: errorMessage },
      });
    } catch (logError) {
      console.error("Failed to log sync error:", logError);
    }

    return NextResponse.json(
      {
        error: "Failed to sync emails",
        details: errorMessage,
        success: false,
        totalMessages: 0,
        successCount: 0,
        errorCount: 1,
      },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint for testing
export async function GET() {
  console.log("Gmail sync triggered via GET request");
  return POST();
}
