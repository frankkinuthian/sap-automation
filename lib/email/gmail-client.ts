import { google } from "googleapis";

export interface ParsedEmailMessage {
  messageId: string;
  channel: "email";
  customerEmail: string;
  customerName?: string;
  subject?: string;
  body: string;
  receivedAt: number;
  attachments?: string[];
}

export class GmailClient {
  private gmail;
  private auth;

  constructor() {
    // Initialize Google Auth with service account credentials
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    });

    this.gmail = google.gmail({ version: "v1", auth: this.auth });
  }

  async getUnreadMessages(): Promise<ParsedEmailMessage[]> {
    try {
      console.log("Fetching unread Gmail messages...");

      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: "is:unread", // Only get unread emails
        maxResults: 50, // Limit to prevent overwhelming the system
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

          return this.parseGmailMessage(
            details.data as Record<string, unknown>
          );
        })
      );

      return messageDetails.filter(
        (msg) => msg !== null
      ) as ParsedEmailMessage[];
    } catch (error) {
      console.error("Error fetching Gmail messages:", error);
      throw error;
    }
  }

  private parseGmailMessage(
    message: Record<string, unknown>
  ): ParsedEmailMessage | null {
    try {
      const payload = message.payload as Record<string, unknown>;
      const headers =
        (payload?.headers as Array<{ name: string; value: string }>) || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      if (!from) {
        console.warn("Message missing From header, skipping");
        return null;
      }

      // Extract email address from "Name <email@domain.com>" format
      const emailMatch = from.match(/<([^>]+)>/);
      const customerEmail = emailMatch ? emailMatch[1] : from;
      const customerName = emailMatch
        ? from.replace(emailMatch[0], "").trim()
        : "";

      // Get message body
      const body = this.extractMessageBody(payload);

      return {
        messageId: message.id as string,
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

  private extractMessageBody(payload: Record<string, unknown>): string {
    let body = "";

    // Single part message
    const payloadBody = payload.body as Record<string, unknown>;
    if (payloadBody?.data) {
      body = Buffer.from(payloadBody.data as string, "base64").toString(
        "utf-8"
      );
    }
    // Multipart message
    else if (payload.parts) {
      body = this.extractFromParts(
        payload.parts as Array<Record<string, unknown>>
      );
    }

    return body;
  }

  private extractFromParts(parts: Array<Record<string, unknown>>): string {
    let text = "";

    for (const part of parts) {
      const partBody = part.body as Record<string, unknown>;
      if (part.mimeType === "text/plain" && partBody?.data) {
        text += Buffer.from(partBody.data as string, "base64").toString(
          "utf-8"
        );
      } else if (part.parts) {
        // Recursive for nested parts
        text += this.extractFromParts(
          part.parts as Array<Record<string, unknown>>
        );
      }
    }

    return text;
  }

  // Mark message as read (optional - use after processing)
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

  // Send email reply (for future use in customer communication)
  async sendReply(to: string, subject: string, body: string): Promise<void> {
    try {
      const emailContent = [
        'Content-Type: text/plain; charset="UTF-8"\n',
        "MIME-Version: 1.0\n",
        `To: ${to}\n`,
        `Subject: ${subject}\n\n`,
        body,
      ].join("");

      const encodedMessage = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await this.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }
}
