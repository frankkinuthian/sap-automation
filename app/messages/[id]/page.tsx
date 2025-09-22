"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { ConvexHttpClient } from "convex/browser";
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
import {
  Trash2,
  Zap,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

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
  // const [lastRefresh, setLastRefresh] = useState(Date.now()); // Removed - not used

  // Initialize Convex client for polling
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const message = useQuery(
    api.messages.getById,
    id ? { id: id as Id<"messages"> } : "skip"
  );
  const deleteByMessageIds = useMutation(api.messages.deleteByMessageIds);

  const formatDate = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toLocaleString() : "-";

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
    if (!message) return;

    // console.log("🔵 Process with AI button clicked for message:", message._id);
    setIsProcessing(true);
    const toastId = toast.loading("Triggering AI processing...");

    try {
      // console.log("🔵 Calling AI process API with messageId:", message._id);
      const response = await fetch("/api/ai/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageIds: [message._id],
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

        // Poll for status updates every 3 seconds
        const pollInterval = setInterval(async () => {
          // Polling for status updates - no need to set refresh state

          // Check if message status has changed
          try {
            const updatedMessage = await convex.query(api.messages.getById, {
              id: id as Id<"messages">,
            });

            if (updatedMessage && updatedMessage.status !== "processing") {
              clearInterval(pollInterval);
              if (updatedMessage.status === "parsed") {
                toast.success("AI processing completed!", {
                  description: "Message has been successfully analyzed.",
                });
              } else if (updatedMessage.status === "failed") {
                toast.error("AI processing failed", {
                  description: "Please check the system logs for details.",
                });
              }
              // Refresh to show updated data
              setTimeout(() => window.location.reload(), 1000);
            }
          } catch (error) {
            console.error("Error polling for status:", error);
          }
        }, 3000);

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
        }, 120000);
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
          {message.status === "received" && (
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
                {message.subject || "No subject"}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{message.channel}</Badge>
                <Badge
                  variant={
                    message.status === "parsed" ||
                    message.status === "completed"
                      ? "default"
                      : message.status === "failed"
                      ? "destructive"
                      : message.status === "processing"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {message.status === "processing" && (
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {message.status}
                </Badge>
                {message.archivedAt && (
                  <Badge variant="outline">Archived</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Received: {formatDate(message.receivedAt)}
                </span>
                {message.processedAt && (
                  <span className="text-xs text-muted-foreground">
                    • Processed: {formatDate(message.processedAt)}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Message Body */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Message Content</h3>
            <MessageBody body={message.body || ""} />
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
                    {message.customerName || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{message.customerEmail || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{message.customerPhone || "-"}</p>
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

          <div>
            <h3 className="text-lg font-semibold mb-3">AI Analysis</h3>
            <AIDataDisplay
              data={message.aiParsedData || null}
              messageId={message._id}
              onTriggerProcessing={handleTriggerProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
