import { describe, it, expect, vi } from "vitest";
import { excelProcessor } from "@/lib/files/excel-processor";

describe("Excel Parser Integration", () => {
  it("should process a realistic shipping Excel format", () => {
    const shippingData = `
Item,Description,Quantity,Unit,Brand,Notes
Fresh Beef,Grade A beef cuts,100,kg,Premium Meats,Keep frozen
Rice,Long grain rice,50,bags,Golden Rice,25kg bags
Water,Drinking water,200,liters,Pure Water,1.5L bottles
    `;

    const isValid = excelProcessor.validateExcelFormat(shippingData);
    expect(isValid).toBe(true);
  });

  it("should handle maritime provisioning categories", () => {
    const provisioningData = `
Category,Item,Quantity,Unit
PROVISIONS,Fresh vegetables,50,kg
BONDED_STORES,Wine,24,bottles
DECK_STORES,Cleaning supplies,10,boxes
ENGINE_STORES,Lubricants,200,liters
    `;

    const isValid = excelProcessor.validateExcelFormat(provisioningData);
    expect(isValid).toBe(true);
  });

  it("should extract basic vessel information", () => {
    const vesselData = `
VESSEL: Test Ship
PORT: Test Port
ARRIVAL: 01/01/2024

Item,Qty
Test,100
    `;

    const vesselInfo = excelProcessor.extractVesselInfo(vesselData);
    expect(vesselInfo.vesselName).toBeDefined();
    expect(vesselInfo.port).toBeDefined();
  });

  it("should convert array data to CSV", () => {
    const arrayData = [
      ["Item", "Quantity"],
      ["Beef", 100],
      ["Rice", 50],
    ];

    const csv = excelProcessor.convertToCSV(arrayData);
    expect(csv).toContain("Item");
    expect(csv).toContain("Beef");
    expect(csv).toContain("100");
  });

  it("should detect file formats", () => {
    // Test XLSX signature
    const xlsxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(excelProcessor.detectExcelFormat(xlsxBuffer)).toBe("xlsx");

    // Test CSV content
    const csvBuffer = Buffer.from("Item,Quantity\nBeef,100");
    expect(excelProcessor.detectExcelFormat(csvBuffer)).toBe("csv");
  });
});
