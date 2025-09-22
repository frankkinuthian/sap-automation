import * as XLSX from "xlsx";

/**
 * Interface for Excel processing operations
 */
interface ExcelProcessor {
  extractExcelContent(filePath: string): Promise<string>;
  extractExcelContentFromBuffer(
    buffer: Buffer,
    filename?: string
  ): Promise<string>;
  validateExcelFormat(content: string): boolean;
  convertToCSV(excelContent: any): string;
  detectExcelFormat(buffer: Buffer): "xlsx" | "xls" | "csv" | "unknown";
}

/**
 * Service for processing Excel files and converting them to formats suitable for AI analysis
 */
export class ExcelProcessorService implements ExcelProcessor {
  /**
   * Extract content from Excel file path
   */
  async extractExcelContent(filePath: string): Promise<string> {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      return this.processWorkbook(workbook);
    } catch (error) {
      throw new Error(
        `Failed to read Excel file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Extract content from Excel buffer (for file uploads)
   */
  async extractExcelContentFromBuffer(
    buffer: Buffer,
    filename?: string
  ): Promise<string> {
    try {
      // Detect file format
      const format = this.detectExcelFormat(buffer);

      if (format === "unknown") {
        throw new Error(
          `Unsupported file format for file: ${filename || "unknown"}`
        );
      }

      // Read the Excel file from buffer
      const workbook = XLSX.read(buffer, { type: "buffer" });
      return this.processWorkbook(workbook, filename);
    } catch (error) {
      throw new Error(
        `Failed to process Excel buffer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Process workbook and extract meaningful content
   */
  private processWorkbook(workbook: XLSX.WorkBook, filename?: string): string {
    const sheets = workbook.SheetNames;
    let extractedContent = "";

    // Add file metadata
    if (filename) {
      extractedContent += `FILENAME: ${filename}\n`;
    }
    extractedContent += `SHEETS: ${sheets.join(", ")}\n`;
    extractedContent += `TOTAL_SHEETS: ${sheets.length}\n\n`;

    // Process each sheet
    sheets.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];

      // Add sheet header
      extractedContent += `=== SHEET ${index + 1}: ${sheetName} ===\n`;

      // Convert sheet to CSV format for better AI parsing
      const csvData = XLSX.utils.sheet_to_csv(worksheet);

      if (csvData.trim()) {
        extractedContent += csvData + "\n\n";
      } else {
        extractedContent += "[EMPTY SHEET]\n\n";
      }

      // Also extract as JSON for structured data (first 100 rows to avoid huge outputs)
      try {
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          range: 100, // Limit to first 100 rows
        });

        if (jsonData.length > 0) {
          extractedContent += `--- STRUCTURED DATA FOR ${sheetName} ---\n`;
          extractedContent +=
            JSON.stringify(jsonData.slice(0, 50), null, 2) + "\n\n"; // First 50 rows as JSON
        }
      } catch (jsonError) {
        // If JSON conversion fails, continue with CSV only
        console.warn(
          `Failed to convert sheet ${sheetName} to JSON:`,
          jsonError
        );
      }
    });

    return extractedContent;
  }

  /**
   * Validate that the content looks like a valid shipping items spreadsheet
   */
  validateExcelFormat(content: string): boolean {
    const lowerContent = content.toLowerCase();

    // Check for common shipping/provisioning keywords
    const shippingKeywords = [
      "item",
      "product",
      "description",
      "quantity",
      "qty",
      "unit",
      "vessel",
      "ship",
      "provision",
      "store",
      "supply",
      "brand",
      "specification",
      "spec",
      "package",
      "packaging",
    ];

    // Check for common units
    const unitKeywords = [
      "kg",
      "ton",
      "mt",
      "piece",
      "pcs",
      "box",
      "case",
      "carton",
      "liter",
      "litre",
      "gallon",
      "drum",
      "bag",
      "pack",
    ];

    // Check for maritime-specific terms
    const maritimeKeywords = [
      "bonded",
      "deck",
      "engine",
      "cabin",
      "galley",
      "mess",
      "port",
      "arrival",
      "eta",
      "imo",
      "flag",
      "agent",
      "provisions",
      "stores",
      "vessel",
      "ship",
    ];

    // Count matches
    const shippingMatches = shippingKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    ).length;

    const unitMatches = unitKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    ).length;

    const maritimeMatches = maritimeKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    ).length;

    // Require at least 2 shipping keywords and 1 unit keyword, or 1 maritime keyword
    return (shippingMatches >= 2 && unitMatches >= 1) || maritimeMatches >= 1;
  }

  /**
   * Convert Excel data to CSV format
   */
  convertToCSV(excelContent: any): string {
    if (typeof excelContent === "string") {
      return excelContent; // Already in text format
    }

    if (Array.isArray(excelContent)) {
      // Convert array of arrays to CSV
      return excelContent
        .map((row) =>
          Array.isArray(row)
            ? row
                .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                .join(",")
            : String(row)
        )
        .join("\n");
    }

    // Try to convert object to CSV
    try {
      return JSON.stringify(excelContent, null, 2);
    } catch {
      return String(excelContent);
    }
  }

  /**
   * Detect Excel file format from buffer
   */
  detectExcelFormat(buffer: Buffer): "xlsx" | "xls" | "csv" | "unknown" {
    // Check file signatures
    const signature = buffer.slice(0, 8);

    // XLSX files start with PK (ZIP signature)
    if (signature[0] === 0x50 && signature[1] === 0x4b) {
      return "xlsx";
    }

    // XLS files have specific OLE signature
    if (
      signature[0] === 0xd0 &&
      signature[1] === 0xcf &&
      signature[2] === 0x11 &&
      signature[3] === 0xe0
    ) {
      return "xls";
    }

    // Check if it's likely a CSV file (text-based)
    const textContent = buffer.toString(
      "utf8",
      0,
      Math.min(1000, buffer.length)
    );
    if (this.isLikelyCSV(textContent)) {
      return "csv";
    }

    return "unknown";
  }

  /**
   * Check if content is likely CSV format
   */
  private isLikelyCSV(content: string): boolean {
    // Check for common CSV characteristics
    const lines = content.split("\n").slice(0, 10); // Check first 10 lines

    if (lines.length < 2) return false;

    // Check for consistent comma separation
    const commaCount = lines[0].split(",").length;
    if (commaCount < 2) return false;

    // Check if other lines have similar comma count
    const consistentCommas = lines.slice(1, 5).every((line) => {
      const lineCommas = line.split(",").length;
      return Math.abs(lineCommas - commaCount) <= 1; // Allow 1 comma difference
    });

    return consistentCommas;
  }

  /**
   * Extract vessel information from Excel content
   */
  extractVesselInfo(content: string): {
    vesselName?: string;
    arrivalDate?: string;
    port?: string;
    quotationRef?: string;
  } {
    const lines = content.split("\n");
    const vesselInfo: any = {};

    // Look for vessel information in the first 20 lines (usually in headers)
    const headerLines = lines.slice(0, 20);

    // Process each line individually for better matching
    for (const line of headerLines) {
      const lowerLine = line.toLowerCase().trim();

      // Extract vessel name (look for patterns like "vessel: name" or "ship: name")
      if (!vesselInfo.vesselName) {
        const vesselMatch = lowerLine.match(
          /(?:vessel|ship|mv|ss)(?:\s+name)?\s*:?\s*(.+)/i
        );
        if (vesselMatch && vesselMatch[1]) {
          vesselInfo.vesselName = vesselMatch[1].trim();
        }
      }

      // Extract port information
      if (!vesselInfo.port) {
        const portMatch = lowerLine.match(
          /(?:port|destination)(?:\s+of\s+call)?\s*:?\s*(.+)/i
        );
        if (portMatch && portMatch[1]) {
          vesselInfo.port = portMatch[1].trim();
        }
      }

      // Extract dates (look for various date formats)
      if (!vesselInfo.arrivalDate) {
        const dateMatch = lowerLine.match(
          /(?:arrival|eta|date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i
        );
        if (dateMatch && dateMatch[1]) {
          vesselInfo.arrivalDate = dateMatch[1].trim();
        }
      }

      // Extract quotation reference
      if (!vesselInfo.quotationRef) {
        const quotationMatch = lowerLine.match(
          /(?:quotation|quote|ref|reference)\s*:?\s*([a-zA-Z0-9\-_]+)/i
        );
        if (quotationMatch && quotationMatch[1]) {
          vesselInfo.quotationRef = quotationMatch[1].trim();
        }
      }
    }

    return vesselInfo;
  }
}

// Export a singleton instance
export const excelProcessor = new ExcelProcessorService();

// Export types for use in other modules
export type { ExcelProcessor };
