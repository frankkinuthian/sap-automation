"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MessageBodyProps {
  body: string;
  className?: string;
}

export function MessageBody({ body, className }: MessageBodyProps) {
  // Clean up the message body by removing excessive whitespace and formatting
  const cleanBody = (text: string): string => {
    if (!text) return "(No content)";

    // Remove excessive line breaks (more than 2 consecutive)
    let cleaned = text.replace(/\n{3,}/g, "\n\n");

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    // If it looks like JSON or structured data, try to format it better
    if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
      try {
        const parsed = JSON.parse(cleaned);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If it's not valid JSON, continue with regular formatting
      }
    }

    // Handle email-style quoted text (lines starting with >)
    const lines = cleaned.split("\n");
    const formattedLines = lines.map((line) => {
      if (line.trim().startsWith(">")) {
        return line; // Keep quoted text as-is
      }
      return line;
    });

    return formattedLines.join("\n");
  };

  const formatMessageBody = (text: string): React.JSX.Element => {
    const cleaned = cleanBody(text);
    const lines = cleaned.split("\n");

    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          const trimmedLine = line.trim();

          // Empty lines
          if (!trimmedLine) {
            return <div key={index} className="h-2" />;
          }

          // Quoted text (email replies)
          if (trimmedLine.startsWith(">")) {
            return (
              <div
                key={index}
                className="border-l-2 border-muted pl-3 text-muted-foreground text-sm"
              >
                {trimmedLine.substring(1).trim()}
              </div>
            );
          }

          // Headers or important lines (all caps, or ending with :)
          if (
            trimmedLine === trimmedLine.toUpperCase() &&
            trimmedLine.length > 3 &&
            trimmedLine.length < 50
          ) {
            return (
              <div key={index} className="font-semibold text-sm">
                {trimmedLine}
              </div>
            );
          }

          // Lines ending with colon (likely headers)
          if (trimmedLine.endsWith(":") && trimmedLine.length < 50) {
            return (
              <div key={index} className="font-medium text-sm">
                {trimmedLine}
              </div>
            );
          }

          // Regular text
          return (
            <div key={index} className="text-sm leading-relaxed">
              {trimmedLine}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="max-h-96 overflow-y-auto">
          {formatMessageBody(body)}
        </div>
      </CardContent>
    </Card>
  );
}
