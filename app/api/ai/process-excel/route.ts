import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import convex from "@/lib/convexClient";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const messageId = formData.get("messageId") as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "No messageId provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];

    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.",
        },
        { status: 400 }
      );
    }

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File too large. Maximum size is 10MB.",
        },
        { status: 400 }
      );
    }

    // Verify message exists
    const message = await convex.query(api.messages.getById, {
      id: messageId as Id<"messages">,
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Convert file to buffer and base64 for transmission
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // Generate a unique attachment ID for manual uploads
    const attachmentId = `manual_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Note: Attachment metadata will be added through the Excel processing function
    // since Convex doesn't allow direct array manipulation in mutations

    // Trigger Excel processing using the file buffer approach
    const eventResult = await inngest.send({
      name: "ai/process.excel",
      data: {
        messageId,
        fileBuffer: base64Data,
        filename: file.name,
        attachmentId,
        isManualUpload: true,
      },
    });

    // Log the manual upload
    await convex.mutation(api.systemLogs.create, {
      level: "info",
      message: `Manual Excel file uploaded for message ${messageId}: ${file.name}`,
      source: "manual_upload",
      data: {
        messageId,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        attachmentId,
        eventId: eventResult.ids[0],
      },
    });

    return NextResponse.json({
      success: true,
      message: "Excel file uploaded and processing started",
      attachmentId,
      filename: file.name,
      fileSize: file.size,
      eventId: eventResult.ids[0],
    });
  } catch (error) {
    console.error("Error processing Excel upload:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check upload status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId parameter required" },
        { status: 400 }
      );
    }

    const message = await convex.query(api.messages.getById, {
      id: messageId as Id<"messages">,
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Get Excel attachments from both regular attachments and manual uploads
    const regularExcelAttachments =
      message.attachmentMetadata?.filter((att) => att.isExcel) || [];

    const manualExcelAttachments =
      message.aiParsedData?.manualAttachments || [];

    // Combine both types of attachments
    const allExcelAttachments = [
      ...regularExcelAttachments.map((att) => ({
        attachmentId: att.attachmentId,
        filename: att.filename,
        size: att.size,
        processed: att.processed,
        processedAt: att.processedAt,
        hasError: !!att.processingError,
        error: att.processingError,
        source: "email" as const,
      })),
      ...manualExcelAttachments.map((att: any) => ({
        attachmentId: att.attachmentId,
        filename: att.filename,
        size: att.size,
        processed: att.processed,
        processedAt: att.processedAt,
        hasError: !!att.processingError,
        error: att.processingError,
        source: "manual" as const,
      })),
    ];

    return NextResponse.json({
      success: true,
      messageId,
      attachments: allExcelAttachments,
    });
  } catch (error) {
    console.error("Error checking upload status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
