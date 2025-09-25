"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  Ship,
  Package,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface ExcelData {
  processedAt?: number;
  totalItems?: number;
  confidenceScore?: number;
  items?: Array<{
    itemCode?: string;
    itemName: string;
    quantity: number;
    unit: string;
    specifications?: string;
    category?: string;
    brand?: string;
    packaging?: string;
    notes?: string;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  vesselInfo?: {
    vesselName?: string;
    arrivalDate?: string;
    port?: string;
    quotationReference?: string;
    imo?: string;
    flag?: string;
    agent?: string;
  };
  extractionNotes?: string;
  currency?: string;
  totalValue?: number;
  sapFormat?: {
    businessPartner?: string;
    currency?: string;
    totalValue?: number;
    items?: Array<{
      ItemCode: string;
      ItemName: string;
      Quantity: number;
      UoMEntry: string;
      ItemRemarks?: string;
      ItemGroup: string;
      Brand?: string;
      PackagingRequirements?: string;
      UnitPrice?: number;
      LineTotal?: number;
    }>;
    vesselInfo?: any;
    processedAt?: number;
  };
}

interface ExcelDataViewProps {
  data: ExcelData;
  showHeader?: boolean;
  compact?: boolean;
}

export function ExcelDataView({
  data,
  showHeader = true,
  compact = false,
}: ExcelDataViewProps) {
  const formatDate = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toLocaleString() : "-";

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-lg">{data.totalItems || 0}</div>
            <div className="text-sm text-muted-foreground">Items</div>
          </div>
          {data.totalValue && (
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium text-lg">
                {data.currency || "$"}
                {data.totalValue.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>
          )}
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-lg">
              {Math.round((data.confidenceScore || 0) * 100)}%
            </div>
            <div className="text-sm text-muted-foreground">Confidence</div>
          </div>
        </div>

        {/* Items Preview */}
        {data.items && data.items.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Items ({data.items.length})</h4>
            <div className="space-y-2">
              {data.items.slice(0, 3).map((item: any, index: number) => (
                <div key={index} className="text-sm border rounded p-2">
                  <div className="font-medium">{item.itemName}</div>
                  <div className="text-muted-foreground">
                    {item.quantity} {item.unit}
                    {item.totalPrice && (
                      <span className="ml-2">
                        - {data.currency || "$"}
                        {item.totalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {data.items.length > 3 && (
                <div className="text-sm text-muted-foreground text-center">
                  +{data.items.length - 3} more items
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Excel Data ({data.totalItems || 0} items)
            </CardTitle>
            <CardDescription>
              Processed on {formatDate(data.processedAt)}
              {data.confidenceScore && (
                <span>
                  {" "}
                  • {Math.round(data.confidenceScore * 100)}% confidence
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Vessel Information */}
      {data.vesselInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-blue-600" />
              Vessel Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.vesselInfo.vesselName && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Vessel Name:
                  </span>
                  <p className="text-sm font-medium">
                    {data.vesselInfo.vesselName}
                  </p>
                </div>
              )}
              {data.vesselInfo.arrivalDate && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Arrival Date:
                  </span>
                  <p className="text-sm font-medium">
                    {data.vesselInfo.arrivalDate}
                  </p>
                </div>
              )}
              {data.vesselInfo.port && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Port:
                  </span>
                  <p className="text-sm font-medium">{data.vesselInfo.port}</p>
                </div>
              )}
              {data.vesselInfo.quotationReference && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Quote Reference:
                  </span>
                  <p className="text-sm font-medium">
                    {data.vesselInfo.quotationReference}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      {data.items && data.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items ({data.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.items.map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-lg">{item.itemName}</h4>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {item.quantity} {item.unit}
                      </div>
                      {item.totalPrice && (
                        <div className="text-sm text-muted-foreground">
                          {data.currency || "$"}
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
                        <span className="text-muted-foreground">Category:</span>
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
                          {data.currency || "$"}
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
                      <span className="text-muted-foreground">Packaging:</span>
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
      {data.sapFormat && data.sapFormat.items && (
        <Card>
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
                    {data.sapFormat.businessPartner}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-green-800">Currency:</span>
                  <p className="text-green-700">{data.sapFormat.currency}</p>
                </div>
                {data.sapFormat.totalValue && (
                  <div>
                    <span className="font-medium text-green-800">
                      Total Value:
                    </span>
                    <p className="text-green-700">
                      {data.sapFormat.currency}
                      {data.sapFormat.totalValue.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <span className="font-medium text-green-800">Items Count:</span>
                <p className="text-green-700">{data.sapFormat.items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Notes */}
      {data.extractionNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Extraction Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">{data.extractionNotes}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
