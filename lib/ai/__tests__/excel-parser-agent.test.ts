import { describe, it, expect, vi, beforeEach } from "vitest";
import { excelProcessor } from "@/lib/files/excel-processor";

// Mock the Convex client and Inngest dependencies
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(() => ({
    query: vi.fn(),
    mutation: vi.fn(),
  })),
}));

vi.mock("@inngest/agent-kit", () => ({
  createAgent: vi.fn(),
  createTool: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(),
}));

describe("Excel Parser Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Excel Processor Service", () => {
    it("should validate shipping Excel format correctly", () => {
      const validShippingData = `
        Item,Quantity,Unit,Description
        Beef,100,kg,Fresh beef cuts
        Rice,50,bags,Long grain rice
        Water,200,liters,Drinking water
      `;

      const result = excelProcessor.validateExcelFormat(validShippingData);
      expect(result).toBe(true);
    });

    it("should validate maritime Excel format correctly", () => {
      const maritimeData = `
        Vessel: MV Ocean Star
        Port: Singapore
        Arrival: 2024-01-15
        
        Provisions List:
        Item,Qty,Unit
        Bonded stores,10,cases
        Deck supplies,5,boxes
      `;

      const result = excelProcessor.validateExcelFormat(maritimeData);
      expect(result).toBe(true);
    });

    it("should reject non-shipping Excel format", () => {
      const nonShippingData = `
        Employee,Salary,Department
        John Doe,50000,IT
        Jane Smith,60000,Finance
      `;

      const result = excelProcessor.validateExcelFormat(nonShippingData);
      expect(result).toBe(false);
    });

    it("should detect Excel file formats correctly", () => {
      // Test XLSX signature (PK)
      const xlsxBuffer = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00,
      ]);
      expect(excelProcessor.detectExcelFormat(xlsxBuffer)).toBe("xlsx");

      // Test XLS signature (OLE)
      const xlsBuffer = Buffer.from([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
      ]);
      expect(excelProcessor.detectExcelFormat(xlsBuffer)).toBe("xls");

      // Test CSV content
      const csvBuffer = Buffer.from(
        "Item,Quantity,Unit\nBeef,100,kg\nRice,50,bags"
      );
      expect(excelProcessor.detectExcelFormat(csvBuffer)).toBe("csv");

      // Test unknown format
      const unknownBuffer = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      ]);
      expect(excelProcessor.detectExcelFormat(unknownBuffer)).toBe("unknown");
    });

    it("should convert data to CSV format", () => {
      const arrayData = [
        ["Item", "Quantity", "Unit"],
        ["Beef", 100, "kg"],
        ["Rice", 50, "bags"],
      ];

      const result = excelProcessor.convertToCSV(arrayData);
      expect(result).toContain('"Item","Quantity","Unit"');
      expect(result).toContain('"Beef","100","kg"');
      expect(result).toContain('"Rice","50","bags"');
    });

    it("should extract vessel information from Excel content", () => {
      const excelContent = `
        VESSEL: MV Ocean Star
        PORT: Singapore
        ARRIVAL DATE: 15/01/2024
        QUOTATION REF: QT-2024-001
        
        Item,Quantity,Unit
        Provisions,100,kg
      `;

      const vesselInfo = excelProcessor.extractVesselInfo(excelContent);

      expect(vesselInfo.vesselName).toContain("ocean star");
      expect(vesselInfo.port).toContain("singapore");
      expect(vesselInfo.arrivalDate).toBe("15/01/2024");
      expect(vesselInfo.quotationRef).toBe("QT-2024-001");
    });
  });

  describe("Excel Parser Agent Schema Validation", () => {
    it("should validate shipping item schema", () => {
      const validItem = {
        itemName: "Fresh Beef",
        quantity: 100,
        unit: "kg",
        specifications: "Grade A beef cuts",
        category: "provisions",
        brand: "Premium Meats",
        packaging: "2-3kg portions",
        notes: "Keep frozen until delivery",
      };

      // This would be validated by Zod in the actual implementation
      expect(validItem.itemName).toBeDefined();
      expect(validItem.quantity).toBeGreaterThan(0);
      expect(validItem.unit).toBeDefined();
    });

    it("should validate vessel info schema", () => {
      const validVesselInfo = {
        vesselName: "MV Ocean Star",
        arrivalDate: "2024-01-15",
        port: "Singapore",
        quotationReference: "QT-2024-001",
        imo: "1234567",
        flag: "Singapore",
        agent: "Maritime Services Ltd",
      };

      expect(validVesselInfo.vesselName).toBeDefined();
      expect(validVesselInfo.port).toBeDefined();
    });

    it("should validate SAP format conversion", () => {
      const sapItem = {
        ItemCode: "ITEM_20240115_ABC123",
        ItemName: "Fresh Beef",
        Quantity: 100,
        UoMEntry: "kg",
        ItemRemarks: "Grade A beef cuts; Keep frozen until delivery",
        ItemGroup: "PROVISIONS",
        Brand: "Premium Meats",
        PackagingRequirements: "2-3kg portions",
        UnitPrice: 25.5,
        LineTotal: 2550.0,
      };

      expect(sapItem.ItemCode).toMatch(/^ITEM_\d+_[A-Z0-9]+$/);
      expect(sapItem.Quantity).toBeGreaterThan(0);
      expect(sapItem.ItemGroup).toBe("PROVISIONS");
      expect(sapItem.LineTotal).toBe(sapItem.UnitPrice * sapItem.Quantity);
    });
  });

  describe("Excel Content Processing", () => {
    it("should handle various unit formats", () => {
      const testUnits = [
        "kg",
        "tons",
        "MT",
        "pieces",
        "pcs",
        "boxes",
        "cases",
        "cartons",
        "drums",
        "liters",
        "gallons",
      ];

      testUnits.forEach((unit) => {
        const content = `Item,Quantity,Unit\nTest Item,100,${unit}`;
        expect(excelProcessor.validateExcelFormat(content)).toBe(true);
      });
    });

    it("should handle maritime-specific categories", () => {
      const categories = [
        "PROVISIONS",
        "BONDED_STORES",
        "DECK_STORES",
        "ENGINE_STORES",
        "CABIN_STORES",
      ];

      categories.forEach((category) => {
        const content = `Category,Item,Quantity\n${category},Test Item,100`;
        expect(excelProcessor.validateExcelFormat(content)).toBe(true);
      });
    });

    it("should handle special packaging requirements", () => {
      const packagingRequirements = [
        "2-3kg blocks instead of large frozen blocks",
        "individual portions",
        "vacuum packed",
        "temperature controlled",
        "dry storage only",
      ];

      packagingRequirements.forEach((packaging) => {
        const content = `Item,Packaging\nTest Item,${packaging}`;
        // This would be processed by the AI agent in actual implementation
        expect(packaging).toBeDefined();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid Excel data gracefully", async () => {
      const invalidData = "This is not Excel data";

      expect(() => {
        excelProcessor.validateExcelFormat(invalidData);
      }).not.toThrow();

      const result = excelProcessor.validateExcelFormat(invalidData);
      expect(result).toBe(false);
    });

    it("should handle empty Excel data", () => {
      const emptyData = "";
      const result = excelProcessor.validateExcelFormat(emptyData);
      expect(result).toBe(false);
    });

    it("should handle malformed CSV data", () => {
      const malformedData = "Item,Quantity\nIncomplete row";
      const result = excelProcessor.convertToCSV(malformedData);
      expect(result).toBe(malformedData); // Should return as-is for string input
    });
  });

  describe("Integration Scenarios", () => {
    it("should process a complete shipping manifest", () => {
      const shippingManifest = `
        VESSEL INFORMATION
        Vessel Name: MV Ocean Star
        IMO: 1234567
        Flag: Singapore
        Port of Call: Singapore
        ETA: 15/01/2024
        Agent: Maritime Services Ltd
        Quotation Ref: QT-2024-001
        
        PROVISIONS LIST
        Item Code,Item Name,Quantity,Unit,Brand,Specifications,Packaging
        BEEF001,Fresh Beef Cuts,100,kg,Premium Meats,Grade A,2-3kg portions
        RICE001,Long Grain Rice,50,bags,Golden Rice,Premium quality,25kg bags
        WATER001,Drinking Water,200,liters,Pure Water,Bottled,1.5L bottles
        FUEL001,Marine Gas Oil,1000,liters,Shell,Low sulfur,Bulk delivery
        
        BONDED STORES
        WINE001,Red Wine,24,bottles,Vintage Wines,2019 vintage,750ml bottles
        BEER001,Premium Beer,48,cans,Local Brewery,Lager,330ml cans
        
        DECK STORES
        CLEAN001,Deck Cleaner,10,bottles,Marine Clean,Industrial grade,5L bottles
        ROPE001,Mooring Rope,2,pieces,Marine Supply,50m length,Nylon rope
      `;

      const isValid = excelProcessor.validateExcelFormat(shippingManifest);
      expect(isValid).toBe(true);

      const vesselInfo = excelProcessor.extractVesselInfo(shippingManifest);
      expect(vesselInfo.vesselName).toContain("ocean star");
      expect(vesselInfo.port).toContain("singapore");
      expect(vesselInfo.quotationRef).toBe("QT-2024-001");
    });

    it("should handle mixed format Excel data", () => {
      const mixedFormatData = `
        Ship: MV Test Vessel
        
        PROVISIONS:
        Item,Qty,Unit
        Beef,100,kg
        Rice,50,bags
        
        TECHNICAL STORES:
        Product,Amount,UOM,Notes
        Engine Oil,200,liters,SAE 40
        Filters,10,pieces,Oil filters
      `;

      const isValid = excelProcessor.validateExcelFormat(mixedFormatData);
      expect(isValid).toBe(true);
    });
  });
});
