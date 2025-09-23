"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AIDataDisplay } from "@/components/ui/ai-data-display";
import { MessageBody } from "@/components/ui/message-body";
import { ExcelUpload } from "@/components/ui/excel-upload";
import { AttachmentStatus } from "@/components/ui/attachment-status";
import {
  Trash2,
  Zap,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";

export default function MessageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    status?: {
      inngest?: {
        status: string;
      };
    };
    configuration?: Record<string, unknown>;
  } | null>(null);
  const [attachmentRefreshTrigger, setAttachmentRefreshTrigger] = useState(0);

  const message = useQuery(
    api.messages.getById,
    id ? { id: id as Id<"messages"> } : "skip"
  );
  const deleteByMessageIds = useMutation(api.messages.deleteByMessageIds);

  // Memoize message data to prevent unnecessary rerenders
  const memoizedMessage = useMemo(() => message, [message]);

  const formatDate = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toLocaleString() : "-";

  // Show completion toasts when message status changes
  useEffect(() => {
    if (message?.status === "parsed" && isProcessing) {
      toast.success("AI processing completed!", {
        description: "Message has been successfully analyzed.",
      });
      setIsProcessing(false);
    } else if (message?.status === "failed" && isProcessing) {
      toast.error("AI processing failed", {
        description: "Please check the system logs for details.",
      });
      setIsProcessing(false);
    }
  }, [message?.status, isProcessing]);

  // Check AI processing status on component mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch("/api/ai/status");
        const status = await response.json();
        setAiStatus(status);
      } catch (error) {
        console.error("Failed to check AI status:", error);
      }
    };

    checkAIStatus();
  }, []);

  const handleTriggerProcessing = async () => {
    if (!memoizedMessage) return;

    setIsProcessing(true);
    const toastId = toast.loading("Triggering AI processing...");

    try {
      const response = await fetch("/api/ai/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageIds: [memoizedMessage._id],
        }),
      });

      // console.log("🔵 AI process API response status:", response.status);
      const result = await response.json();
      // console.log("🔵 AI process API result:", result);

      if (result.success) {
        toast.success("AI processing triggered successfully", { id: toastId });

        // Show progress message
        toast.info("Processing in progress...", {
          description:
            "This may take 10-30 seconds. The page will refresh automatically.",
          duration: 5000,
        });

        // No need for polling - Convex queries are reactive and will update automatically
      } else {
        const errorMessage = result.message || result.error || "Unknown error";
        toast.error("Failed to trigger AI processing", {
          description: errorMessage,
          id: toastId,
        });

        // If it's an Inngest dev server issue, provide additional guidance
        if (result.error === "Inngest dev server not running") {
          setTimeout(() => {
            toast.info("Development Setup Required", {
              description:
                "Run 'npm run dev:inngest' in a separate terminal to enable AI processing.",
              duration: 8000,
            });
          }, 1000);
        }
      }
    } catch (error) {
      toast.error("Failed to trigger AI processing", {
        description: error instanceof Error ? error.message : "Unknown error",
        id: toastId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (message === undefined) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">
            Message not found
          </h2>
          <Link href="/messages" className="text-sm underline">
            Back to Messages
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Not Found</CardTitle>
            <CardDescription>
              The message you are looking for does not exist or was deleted.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleDelete = async () => {
    const ok = window.confirm(
      "Permanently delete this message? This cannot be undone."
    );
    if (!ok) return;
    const toastId = toast.loading("Deleting message...");
    try {
      await deleteByMessageIds({ messageIds: [message.messageId] });
      toast.success("Message deleted", { id: toastId });
      router.push("/messages");
    } catch (e) {
      toast.error("Failed to delete message", {
        description: e instanceof Error ? e.message : String(e),
        id: toastId,
      });
    }
  };

  if (!memoizedMessage) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="mr-1 h-4 w-4" />
            Dashboard
          </Link>
          <div className="text-muted-foreground">/</div>
          <Link
            href="/messages"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Messages
          </Link>
          <div className="text-muted-foreground">/</div>
          <h2 className="text-3xl font-bold tracking-tight">Message Details</h2>
        </div>
        <div className="flex items-center space-x-2">
          {memoizedMessage?.status === "received" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerProcessing}
                disabled={
                  isProcessing ||
                  Boolean(
                    aiStatus &&
                      aiStatus.status?.inngest?.status === "disconnected"
                  )
                }
              >
                {isProcessing ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                {isProcessing ? "Processing..." : "Process with AI"}
              </Button>

              {aiStatus &&
                aiStatus.status?.inngest?.status === "disconnected" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open("http://localhost:8288", "_blank")
                    }
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Start Inngest
                  </Button>
                )}
            </>
          )}
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Message Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Message Header */}
          <Card>
            <CardHeader>
              <CardTitle className="break-words">
                {memoizedMessage?.subject || "No subject"}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{memoizedMessage?.channel}</Badge>
                <Badge
                  variant={
                    memoizedMessage?.status === "parsed" ||
                    memoizedMessage?.status === "completed"
                      ? "default"
                      : memoizedMessage?.status === "failed"
                      ? "destructive"
                      : memoizedMessage?.status === "processing"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {memoizedMessage?.status === "processing" && (
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {memoizedMessage?.status}
                </Badge>
                {memoizedMessage?.archivedAt && (
                  <Badge variant="outline">Archived</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Received: {formatDate(memoizedMessage?.receivedAt)}
                </span>
                {memoizedMessage?.processedAt && (
                  <span className="text-xs text-muted-foreground">
                    • Processed: {formatDate(memoizedMessage?.processedAt)}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Message Body */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Message Content</h3>
            <MessageBody body={memoizedMessage?.body || ""} />
          </div>

          {/* Basic Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Sender Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">
                    {memoizedMessage?.customerName || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">
                    {memoizedMessage?.customerEmail || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">
                    {memoizedMessage?.customerPhone || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - AI Analysis */}
        <div className="space-y-6">
          {/* AI Status Indicator */}
          {aiStatus && aiStatus.status?.inngest?.status === "disconnected" && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertCircle className="h-5 w-5" />
                  AI Processing Setup Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-orange-700">
                  The Inngest dev server is not running. AI processing functions
                  won&apos;t execute until it&apos;s started.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open("http://localhost:8288", "_blank")
                    }
                    className="w-full"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Inngest Dev UI
                  </Button>
                  <p className="text-xs text-orange-600">
                    Run:{" "}
                    <code className="bg-orange-100 px-1 rounded">
                      npm run dev:inngest
                    </code>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Excel Attachments */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Excel Attachments</h3>
            <div className="space-y-4">
              <AttachmentStatus
                messageId={memoizedMessage?._id || ""}
                refreshTrigger={attachmentRefreshTrigger}
              />
              <ExcelUpload
                messageId={memoizedMessage?._id || ""}
                onUploadComplete={() => {
                  // Trigger refresh of attachment status
                  setAttachmentRefreshTrigger((prev) => prev + 1);
                  // No need to reload - Convex queries are reactive
                }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">AI Analysis</h3>
            <AIDataDisplay
              data={memoizedMessage?.aiParsedData || null}
              messageId={memoizedMessage?._id || ""}
              onTriggerProcessing={handleTriggerProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
