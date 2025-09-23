"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

interface AttachmentInfo {
  attachmentId: string;
  filename: string;
  size: number;
  processed: boolean;
  processedAt?: number;
  hasError: boolean;
  error?: string;
}

interface AttachmentStatusProps {
  messageId: string;
  refreshTrigger?: number; // Used to trigger refresh from parent
}

export function AttachmentStatus({
  messageId,
  refreshTrigger,
}: AttachmentStatusProps) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachmentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/ai/process-excel?messageId=${messageId}`
      );
      const result = await response.json();

      if (result.success) {
        setAttachments(result.attachments || []);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch attachment status");
      }
    } catch (err) {
      console.error("Error fetching attachment status:", err);
      setError("Failed to fetch attachment status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachmentStatus();
  }, [messageId, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (attachment: AttachmentInfo) => {
    if (attachment.hasError) {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (attachment.processed) {
      return <Badge variant="default">Processed</Badge>;
    }
    return <Badge variant="secondary">Processing...</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Excel Attachments</CardTitle>
          <CardDescription>Loading attachment status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Excel Attachments</CardTitle>
          <CardDescription className="text-red-600">
            Error: {error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchAttachmentStatus} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (attachments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Excel Attachments</CardTitle>
          <CardDescription>
            No Excel attachments found for this message
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Excel Attachments</CardTitle>
            <CardDescription>
              {attachments.length} Excel file
              {attachments.length !== 1 ? "s" : ""} found
            </CardDescription>
          </div>
          <Button onClick={fetchAttachmentStatus} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {attachments.map((attachment) => (
            <div
              key={attachment.attachmentId}
              className="border rounded-lg p-4 space-y-2"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {attachment.filename}
                  </div>
                  <div className="text-xs text-gray-500">
                    Size: {formatFileSize(attachment.size)}
                  </div>
                  {attachment.processedAt && (
                    <div className="text-xs text-gray-500">
                      Processed: {formatDate(attachment.processedAt)}
                    </div>
                  )}
                </div>
                <div className="ml-4">{getStatusBadge(attachment)}</div>
              </div>

              {attachment.hasError && attachment.error && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  <strong>Error:</strong> {attachment.error}
                </div>
              )}

              {attachment.processed && !attachment.hasError && (
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                  ✓ Successfully processed and data extracted
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
