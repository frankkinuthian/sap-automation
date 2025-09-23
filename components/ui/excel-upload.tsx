"use client";

import { useState } from "react";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Input } from "./input";
import { toast } from "sonner";

interface ExcelUploadProps {
  messageId: string;
  onUploadComplete?: (result: any) => void;
}

export function ExcelUpload({ messageId, onUploadComplete }: ExcelUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const hasValidExtension = allowedExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      toast.error("Please select an Excel (.xlsx, .xls) or CSV file");
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error("File too large. Maximum size is 10MB");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("messageId", messageId);

      const response = await fetch("/api/ai/process-excel", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Excel file uploaded successfully: ${result.filename}`);
        setFile(null);
        onUploadComplete?.(result);
      } else {
        toast.error(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Excel File</CardTitle>
        <CardDescription>
          Upload an Excel spreadsheet (.xlsx, .xls) or CSV file containing
          shipping items for AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {file ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-green-600">
                ✓ File selected: {file.name}
              </div>
              <div className="text-xs text-gray-500">
                Size: {formatFileSize(file.size)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
                disabled={uploading}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-gray-600">
                Drag and drop your Excel file here, or click to browse
              </div>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    handleFileSelect(selectedFile);
                  }
                }}
                className="max-w-xs mx-auto"
                disabled={uploading}
              />
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="min-w-32"
          >
            {uploading ? "Uploading..." : "Upload & Process"}
          </Button>
        </div>

        {/* File Requirements */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>• Supported formats: .xlsx, .xls, .csv</div>
          <div>• Maximum file size: 10MB</div>
          <div>
            • File should contain shipping items with quantities and
            specifications
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
