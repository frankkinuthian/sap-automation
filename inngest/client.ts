import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "sap-automation",
  name: "SAP Automation AI Processing",
  // In development, Inngest runs locally without cloud keys
  isDev: process.env.NODE_ENV === "development",
  // Use local Inngest dev server in development
  eventKey:
    process.env.NODE_ENV === "development"
      ? undefined
      : process.env.INNGEST_EVENT_KEY,
  baseURL:
    process.env.NODE_ENV === "development"
      ? "http://localhost:8288"
      : undefined,
});
