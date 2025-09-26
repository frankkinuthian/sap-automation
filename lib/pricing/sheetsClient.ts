import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface SheetsConfig {
  spreadsheetId: string;
  pricingTab: string;
}

export function getSheetsConfig(): SheetsConfig {
  return {
    spreadsheetId: process.env.SHEETS_SPREADSHEET_ID || "",
    pricingTab: process.env.SHEETS_PRICING_TAB || "Pricing",
  };
}

export function isSheetsConfigured(): boolean {
  const { spreadsheetId } = getSheetsConfig();
  return !!spreadsheetId;
}

export interface SheetsRow {
  values: string[];
}

export interface SheetsResponse {
  values: SheetsRow[];
  etag?: string;
}

export async function fetchPricingSheetValues(): Promise<SheetsResponse> {
  const { spreadsheetId, pricingTab } = getSheetsConfig();
  
  if (!spreadsheetId) {
    throw new Error("SHEETS_SPREADSHEET_ID environment variable is not set");
  }

  // Read the service account key from sheets-token.json
  const keyPath = join(process.cwd(), 'sheets-token.json');
  const keyData = JSON.parse(readFileSync(keyPath, 'utf8'));

  // Create auth client
  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  // Create sheets client
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Fetch the data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${pricingTab}!A1:Z`, // Read from A1 to Z column
    });

    const values = response.data.values || [];
    
    return {
      values: values.map(row => ({ values: row })),
      etag: (response as any).etag,
    };
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    throw new Error(`Failed to fetch pricing sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


