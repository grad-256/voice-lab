import type { ChatLocale } from "@/lib/chat";
export type { UsageRow } from "@/lib/freePlanUsage";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type RequestBody = {
  message?: string;
  history: Message[];
  assistantFirst?: boolean;
  pastSummaries?: string[];
  locale?: ChatLocale;
};
