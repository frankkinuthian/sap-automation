import { google, gmail_v1, Auth } from "googleapis";
import fs from "fs";
import path from "path";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

// Path to store the token
const TOKEN_PATH = path.join(process.cwd(), "gmail-token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "gmail-credentials.json");

export interface ParsedEmailMessage {
  messageId: string;
  channel: "email";
  customerEmail: string;
  customerName?: string;
  subject?: string;
  body: string;
  receivedAt: number;
}

export class GmailOAuthClient {
  private oAuth2Client: Auth.OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor() {
    try {
      // Load client secrets from downloaded file
      const credentials = this.loadCredentials();
      const { client_secret, client_id, redirect_uris } =
        credentials.web || credentials.installed;

      this.oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0],
      );

      this.gmail = google.gmail({ version: "v1", auth: this.oAuth2Client });

      console.log("Gmail OAuth client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Gmail OAuth client:", error);
      throw error;
    }
  }

  private loadCredentials(): { web?: any; installed?: any } {
    try {
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.error(
          `Gmail credentials file not found at: ${CREDENTIALS_PATH}`,
        );
        console.log("Debug info:", this.getDebugInfo());
        throw new Error(
          "Gmail credentials file not found. Please download OAuth2 credentials from Google Cloud Console and save as 'gmail-credentials.json' in the project root.",
        );
      }

      const credentialsContent = fs.readFileSync(CREDENTIALS_PATH, "utf8");
      const credentials = JSON.parse(credentialsContent);

      if (!this.validateCredentials(credentials)) {
        throw new Error("Invalid credentials file format");
      }

      return credentials;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          "Invalid JSON in gmail-credentials.json file. Please ensure the file contains valid JSON.",
        );
      }
      throw new Error(
        `Failed to load Gmail credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Generate auth URL for user consent
  getAuthUrl(): string {
    return this.oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
  }

  // Exchange authorization code for tokens
  async getTokenFromCode(code: string): Promise<void> {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.oAuth2Client.setCredentials(tokens);

    // Store the token for future use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log("Token stored to", TOKEN_PATH);
  }

  // Load existing token
  async loadSavedToken(): Promise<boolean> {
    try {
      const token = fs.readFileSync(TOKEN_PATH, "utf8");
      const tokens = JSON.parse(token);
      this.oAuth2Client.setCredentials(tokens);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Check if we have valid credentials
  async isAuthenticated(): Promise<boolean> {
    if (!(await this.loadSavedToken())) {
      return false;
    }

    try {
      // Test the credentials by making a simple API call
      await this.gmail.users.getProfile({ userId: "me" });
      return true;
    } catch (error) {
      console.log(
        "Stored token is invalid, need to re-authenticate:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  async getUnreadMessages(): Promise<ParsedEmailMessage[]> {
    if (!(await this.isAuthenticated())) {
      throw new Error(
        "Not authenticated. Please run the authentication flow first.",
      );
    }

    try {
      console.log("Fetching unread Gmail messages...");

      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults: 50,
      });

      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} unread messages`);

      if (messages.length === 0) {
        return [];
      }

      const messageDetails = await Promise.all(
        messages.map(async (message) => {
          const details = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id!,
          });

          return this.parseGmailMessage(details.data);
        }),
      );

      return messageDetails.filter(
        (msg) => msg !== null,
      ) as ParsedEmailMessage[];
    } catch (error) {
      console.error("Error fetching Gmail messages:", error);
      throw error;
    }
  }

  private parseGmailMessage(
    message: gmail_v1.Schema$Message,
  ): ParsedEmailMessage | null {
    try {
      if (!message.payload || !message.id) {
        console.warn("Message missing payload or ID, skipping");
        return null;
      }

      const headers = message.payload.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      if (!from) {
        console.warn("Message missing From header, skipping");
        return null;
      }

      const emailMatch = from.match(/<([^>]+)>/);
      const customerEmail = emailMatch ? emailMatch[1] : from;
      const customerName = emailMatch
        ? from.replace(emailMatch[0], "").trim()
        : "";

      const body = this.extractMessageBody(message.payload);

      return {
        messageId: message.id,
        channel: "email",
        customerEmail: customerEmail.toLowerCase(),
        customerName: customerName || undefined,
        subject,
        body: body.replace(/\r\n/g, "\n").trim(),
        receivedAt: new Date(date).getTime() || Date.now(),
      };
    } catch (error) {
      console.error("Error parsing Gmail message:", error);
      return null;
    }
  }

  private extractMessageBody(payload: gmail_v1.Schema$MessagePart): string {
    let body = "";

    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      body = this.extractFromParts(payload.parts);
    }

    return body;
  }

  private extractFromParts(parts: gmail_v1.Schema$MessagePart[]): string {
    let text = "";

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.parts) {
        text += this.extractFromParts(part.parts);
      }
    }

    return text;
  }

  // Mark message as read (optional)
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  }

  // Validate credentials file format
  validateCredentials(credentials: any): boolean {
    const requiredFields = ["client_id", "client_secret", "redirect_uris"];
    const creds = credentials.web || credentials.installed;

    if (!creds) {
      console.error("Credentials must have 'web' or 'installed' property");
      return false;
    }

    for (const field of requiredFields) {
      if (!creds[field]) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    if (
      !Array.isArray(creds.redirect_uris) ||
      creds.redirect_uris.length === 0
    ) {
      console.error("redirect_uris must be a non-empty array");
      return false;
    }

    return true;
  }

  // Get debug information about the current setup
  getDebugInfo(): { [key: string]: any } {
    const debugInfo: { [key: string]: any } = {
      credentialsFileExists: fs.existsSync(CREDENTIALS_PATH),
      tokenFileExists: fs.existsSync(TOKEN_PATH),
      credentialsPath: CREDENTIALS_PATH,
      tokenPath: TOKEN_PATH,
    };

    try {
      if (debugInfo.credentialsFileExists) {
        const credentials = JSON.parse(
          fs.readFileSync(CREDENTIALS_PATH, "utf8"),
        );
        const creds = credentials.web || credentials.installed;
        debugInfo.hasValidCredentials = this.validateCredentials(credentials);
        debugInfo.clientId = creds?.client_id
          ? `${creds.client_id.substring(0, 20)}...`
          : "missing";
        debugInfo.redirectUris = creds?.redirect_uris || [];
      }

      if (debugInfo.tokenFileExists) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        debugInfo.hasAccessToken = !!tokens.access_token;
        debugInfo.hasRefreshToken = !!tokens.refresh_token;
        debugInfo.tokenExpiry = tokens.expiry_date;
      }
    } catch (error) {
      debugInfo.debugError =
        error instanceof Error ? error.message : String(error);
    }

    return debugInfo;
  }

  // Check if setup is complete
  isSetupComplete(): boolean {
    const debugInfo = this.getDebugInfo();
    return debugInfo.credentialsFileExists && debugInfo.hasValidCredentials;
  }
}
