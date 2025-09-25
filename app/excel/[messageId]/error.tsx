"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ExcelDataError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Excel data page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Link href="/messages">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                All Messages
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Excel Data Error</h1>
          <p className="text-gray-600 mt-2">
            Something went wrong while loading the Excel data
          </p>
        </div>

        {/* Error Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Excel Data
            </CardTitle>
            <CardDescription>
              We encountered an error while trying to load the Excel data for
              this message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <h4 className="font-medium text-red-800 mb-2">Error Details:</h4>
              <p className="text-sm text-red-700 font-mono">
                {error.message || "An unknown error occurred"}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={reset} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Link href="/messages">
                <Button variant="outline" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  All Messages
                </Button>
              </Link>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>If this error persists, please:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check if the message exists and has been processed</li>
                <li>Verify your internet connection</li>
                <li>Try refreshing the page</li>
                <li>Contact support if the issue continues</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
