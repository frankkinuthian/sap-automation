"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  FileText,
  Ship,
  Package,
  AlertTriangle,
  CheckCircle,
  Home,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ExcelDataPage() {
  const params = useParams();
  const router = useRouter();
  const messageId = params?.messageId as string;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const message = useQuery(
    api.messages.getById,
    messageId ? { id: messageId as Id<"messages"> } : "skip"
  );

  const formatDate = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toLocaleString() : "-";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // The Convex query will automatically refresh
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (!message) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const excelData = message.aiParsedData?.excelData;

  if (!excelData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
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
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Excel Data</h1>
            <p className="text-gray-600 mt-2">
              Message: {message.subject || "No subject"}
            </p>
          </div>

          {/* No Excel Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                No Excel Data Available
              </CardTitle>
              <CardDescription>
                This message has not been processed for Excel data yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Excel data will appear here once the message is processed.
                </p>
                <Link href={`/messages/${messageId}`}>
                  <Button>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Message
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
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
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href={`/messages/${messageId}`}>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                View Full Message
              </Button>
            </Link>
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
          <h1 className="text-3xl font-bold text-gray-900">Excel Data</h1>
          <p className="text-gray-600 mt-2">
            Message: {message.subject || "No subject"}
          </p>
        </div>

        {/* Excel Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {excelData.totalItems || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </div>
            </CardContent>
          </Card>

          {excelData.totalValue && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {excelData.currency || "$"}
                    {excelData.totalValue.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Value
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round((excelData.confidenceScore || 0) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Confidence</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatDate(excelData.processedAt).split(",")[0]}
                </div>
                <div className="text-sm text-muted-foreground">
                  Processed Date
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vessel Information */}
        {excelData.vesselInfo && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5 text-blue-600" />
                Vessel Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {excelData.vesselInfo.vesselName && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Vessel Name:
                    </span>
                    <p className="text-sm font-medium">
                      {excelData.vesselInfo.vesselName}
                    </p>
                  </div>
                )}
                {excelData.vesselInfo.arrivalDate && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Arrival Date:
                    </span>
                    <p className="text-sm font-medium">
                      {excelData.vesselInfo.arrivalDate}
                    </p>
                  </div>
                )}
                {excelData.vesselInfo.port && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Port:
                    </span>
                    <p className="text-sm font-medium">
                      {excelData.vesselInfo.port}
                    </p>
                  </div>
                )}
                {excelData.vesselInfo.quotationReference && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Quote Reference:
                    </span>
                    <p className="text-sm font-medium">
                      {excelData.vesselInfo.quotationReference}
                    </p>
                  </div>
                )}
                {excelData.vesselInfo.imo && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      IMO:
                    </span>
                    <p className="text-sm font-medium">
                      {excelData.vesselInfo.imo}
                    </p>
                  </div>
                )}
                {excelData.vesselInfo.flag && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Flag:
                    </span>
                    <p className="text-sm font-medium">
                      {excelData.vesselInfo.flag}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        {excelData.items && excelData.items.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Items ({excelData.items.length})
              </CardTitle>
              <CardDescription>
                Processed on {formatDate(excelData.processedAt)} with{" "}
                {Math.round((excelData.confidenceScore || 0) * 100)}% confidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {excelData.items.map((item: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-lg">{item.itemName}</h4>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {item.quantity} {item.unit}
                        </div>
                        {item.totalPrice && (
                          <div className="text-sm text-muted-foreground">
                            {excelData.currency || "$"}
                            {item.totalPrice.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {item.itemCode && (
                        <div>
                          <span className="text-muted-foreground">Code:</span>
                          <p className="font-medium">{item.itemCode}</p>
                        </div>
                      )}
                      {item.category && (
                        <div>
                          <span className="text-muted-foreground">
                            Category:
                          </span>
                          <p className="font-medium">{item.category}</p>
                        </div>
                      )}
                      {item.brand && (
                        <div>
                          <span className="text-muted-foreground">Brand:</span>
                          <p className="font-medium">{item.brand}</p>
                        </div>
                      )}
                      {item.unitPrice && (
                        <div>
                          <span className="text-muted-foreground">
                            Unit Price:
                          </span>
                          <p className="font-medium">
                            {excelData.currency || "$"}
                            {item.unitPrice}
                          </p>
                        </div>
                      )}
                    </div>

                    {item.specifications && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Specifications:
                        </span>
                        <p className="mt-1">{item.specifications}</p>
                      </div>
                    )}

                    {item.packaging && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Packaging:
                        </span>
                        <p className="mt-1">{item.packaging}</p>
                      </div>
                    )}

                    {item.notes && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Notes:</span>
                        <p className="mt-1">{item.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SAP Format */}
        {excelData.sapFormat && excelData.sapFormat.items && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                SAP Business One Format
              </CardTitle>
              <CardDescription>Ready for SAP import</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-800">
                      Business Partner:
                    </span>
                    <p className="text-green-700">
                      {excelData.sapFormat.businessPartner}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">
                      Currency:
                    </span>
                    <p className="text-green-700">
                      {excelData.sapFormat.currency}
                    </p>
                  </div>
                  {excelData.sapFormat.totalValue && (
                    <div>
                      <span className="font-medium text-green-800">
                        Total Value:
                      </span>
                      <p className="text-green-700">
                        {excelData.sapFormat.currency}
                        {excelData.sapFormat.totalValue.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <span className="font-medium text-green-800">
                    Items Count:
                  </span>
                  <p className="text-green-700">
                    {excelData.sapFormat.items.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extraction Notes */}
        {excelData.extractionNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Extraction Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  {excelData.extractionNotes}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
