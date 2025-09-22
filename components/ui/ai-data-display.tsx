"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  Ship,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  Zap,
  FileText,
  Target,
} from "lucide-react";

interface AIProcessedData {
  processedAt?: number;
  processingVersion?: string;
  aiModel?: string;
  confidenceScore?: number;
  category?: string;
  intent?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  customer?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
    isNewCustomer?: boolean;
    discrepancies?: string[];
  };
  products?: Array<{
    name: string;
    code?: string;
    quantity?: number;
    unit?: string;
    specifications?: string;
    alternatives?: string[];
    confidence?: number;
  }>;
  businessContext?: {
    deadline?: string;
    specialRequirements?: string[];
    paymentTerms?: string;
    deliveryLocation?: string;
    vesselInfo?: {
      name?: string;
      arrivalDate?: string;
      port?: string;
    };
  };
  flags?: {
    requiresManualReview?: boolean;
    hasCalculations?: boolean;
    hasAttachments?: boolean;
    hasExcelAttachment?: boolean;
    hasStructuredItems?: boolean;
    readyForSAP?: boolean;
    isUrgent?: boolean;
    hasDiscrepancies?: boolean;
  };
  urgencyKeywords?: string[];
}

interface AIDataDisplayProps {
  data: AIProcessedData | null;
  messageId: string;
  onTriggerProcessing?: () => void;
}

export function AIDataDisplay({
  data,
  messageId,
  onTriggerProcessing,
}: AIDataDisplayProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            AI Processing
          </CardTitle>
          <CardDescription>
            This message has not been processed by AI yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onTriggerProcessing} className="w-full">
            <Zap className="mr-2 h-4 w-4" />
            Process with AI
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleString();

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "quote_request":
        return <Target className="h-4 w-4" />;
      case "order_inquiry":
        return <Package className="h-4 w-4" />;
      case "support_request":
        return <AlertTriangle className="h-4 w-4" />;
      case "general_inquiry":
        return <FileText className="h-4 w-4" />;
      case "complaint":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Processing Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            AI Processing Complete
          </CardTitle>
          <CardDescription>
            Processed on {formatDate(data.processedAt || Date.now())} using{" "}
            {data.aiModel || "AI"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confidence Score</span>
            <span className="text-sm text-muted-foreground">
              {Math.round((data.confidenceScore || 0) * 100)}%
            </span>
          </div>
          <Progress value={(data.confidenceScore || 0) * 100} className="h-2" />

          {data.flags?.requiresManualReview && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Requires manual review
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Classification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getCategoryIcon(data.category)}
            Message Classification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Category:</span>
            <Badge variant="secondary" className="capitalize">
              {data.category?.replace("_", " ") || "Unknown"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Priority:</span>
            <Badge
              variant={getPriorityColor(data.priority)}
              className="capitalize"
            >
              {data.priority || "Medium"}
            </Badge>
          </div>

          {data.intent && (
            <div>
              <span className="text-sm font-medium">Intent:</span>
              <p className="text-sm text-muted-foreground mt-1">
                {data.intent}
              </p>
            </div>
          )}

          {data.urgencyKeywords && data.urgencyKeywords.length > 0 && (
            <div>
              <span className="text-sm font-medium">Urgency Keywords:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.urgencyKeywords.map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Information */}
      {data.customer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.customer.name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{data.customer.name}</span>
                {data.customer.isNewCustomer && (
                  <Badge variant="outline" className="text-xs">
                    New Customer
                  </Badge>
                )}
              </div>
            )}

            {data.customer.company && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{data.customer.company}</span>
              </div>
            )}

            {data.customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{data.customer.email}</span>
              </div>
            )}

            {data.customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{data.customer.phone}</span>
              </div>
            )}

            {data.customer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{data.customer.address}</span>
              </div>
            )}

            {data.customer.discrepancies &&
              data.customer.discrepancies.length > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">
                      Data Discrepancies
                    </span>
                  </div>
                  <ul className="text-sm text-orange-700 space-y-1">
                    {data.customer.discrepancies.map((discrepancy, index) => (
                      <li key={index}>• {discrepancy}</li>
                    ))}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Products */}
      {data.products && data.products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products & Items ({data.products.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.products.map((product, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{product.name}</h4>
                    {product.confidence && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(product.confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {product.code && (
                      <div>
                        <span className="text-muted-foreground">Code:</span>{" "}
                        {product.code}
                      </div>
                    )}
                    {product.quantity && (
                      <div>
                        <span className="text-muted-foreground">Quantity:</span>{" "}
                        {product.quantity} {product.unit || ""}
                      </div>
                    )}
                  </div>

                  {product.specifications && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Specifications:
                      </span>
                      <p className="mt-1">{product.specifications}</p>
                    </div>
                  )}

                  {product.alternatives && product.alternatives.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Alternatives:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.alternatives.map((alt, altIndex) => (
                          <Badge
                            key={altIndex}
                            variant="outline"
                            className="text-xs"
                          >
                            {alt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Context */}
      {data.businessContext && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Business Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.businessContext.deadline && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deadline:</span>
                <span className="text-sm">{data.businessContext.deadline}</span>
              </div>
            )}

            {data.businessContext.paymentTerms && (
              <div>
                <span className="text-sm font-medium">Payment Terms:</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.businessContext.paymentTerms}
                </p>
              </div>
            )}

            {data.businessContext.deliveryLocation && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Delivery:</span>
                <span className="text-sm">
                  {data.businessContext.deliveryLocation}
                </span>
              </div>
            )}

            {data.businessContext.specialRequirements &&
              data.businessContext.specialRequirements.length > 0 && (
                <div>
                  <span className="text-sm font-medium">
                    Special Requirements:
                  </span>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    {data.businessContext.specialRequirements.map(
                      (req, index) => (
                        <li key={index}>• {req}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {/* Vessel Information */}
            {data.businessContext.vesselInfo && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Vessel Information
                    </span>
                  </div>

                  {data.businessContext.vesselInfo.name && (
                    <div className="ml-6 text-sm">
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {data.businessContext.vesselInfo.name}
                    </div>
                  )}

                  {data.businessContext.vesselInfo.arrivalDate && (
                    <div className="ml-6 text-sm">
                      <span className="text-muted-foreground">Arrival:</span>{" "}
                      {data.businessContext.vesselInfo.arrivalDate}
                    </div>
                  )}

                  {data.businessContext.vesselInfo.port && (
                    <div className="ml-6 text-sm">
                      <span className="text-muted-foreground">Port:</span>{" "}
                      {data.businessContext.vesselInfo.port}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing Flags */}
      {data.flags && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Processing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    data.flags.readyForSAP ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <span>Ready for SAP</span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    data.flags.hasAttachments ? "bg-blue-500" : "bg-gray-300"
                  }`}
                />
                <span>Has Attachments</span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    data.flags.hasCalculations ? "bg-purple-500" : "bg-gray-300"
                  }`}
                />
                <span>Has Calculations</span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    data.flags.hasExcelAttachment
                      ? "bg-orange-500"
                      : "bg-gray-300"
                  }`}
                />
                <span>Excel Attachment</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
