export const runtime = "edge";

import type { ChatLocale } from "@/lib/chat";
import {
  FREE_TURN_LIMIT,
  GUEST_COOKIE_NAME,
  checkTurnLimit,
  parseCookieValue,
} from "@/lib/freePlanUsage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callLLM } from "./_lib/llm";
import type { RequestBody, UsageRow } from "./_lib/types";
import { buildGuestResponse, updateGuestUsage, updateUserUsage } from "./_lib/usage";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { message, history, assistantFirst, pastSummaries, locale } = body;
    const safeLocale: ChatLocale = locale === "en" ? "en" : "ja";

    const today = new Date().toISOString().split("T")[0];
    const isUserTurn = Boolean(message);

    let user: { id: string } | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // 認証エラーはゲスト扱いで続行
    }

    if (user) {
      let usage: UsageRow = null;
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("daily_usage")
          .select("turns")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        if (error) console.error("daily_usage read error:", error);
        usage = data as UsageRow;
      } catch (e) {
        console.error("daily_usage read exception:", e);
      }

      const check = checkTurnLimit(usage);
      if (!check.allowed) return Response.json({ error: check.reason }, { status: 403 });

      const isLastTurn = isUserTurn && (usage?.turns ?? 0) === FREE_TURN_LIMIT - 1;
      const llm = await callLLM({
        message,
        history,
        assistantFirst,
        pastSummaries,
        safeLocale,
        isLastTurn,
      });
      if (llm.error) return llm.error;

      updateUserUsage(user.id, today, usage, isUserTurn).catch((e) =>
        console.error("daily_usage upsert error:", e)
      );
      return llm.response;
    }

    // ゲストユーザー
    const cookieHeader = req.headers.get("cookie");
    let guestId = parseCookieValue(cookieHeader, GUEST_COOKIE_NAME);
    const isNewGuest = !guestId;
    if (!guestId) guestId = crypto.randomUUID();

    const adminClient = createAdminClient();
    let usage: UsageRow = null;
    try {
      const { data, error } = await adminClient
        .from("guest_usage")
        .select("turns")
        .eq("guest_id", guestId)
        .eq("date", today)
        .maybeSingle();
      if (error) console.error("guest_usage read error:", error);
      usage = data as UsageRow;
    } catch (e) {
      console.error("guest_usage read exception:", e);
    }

    const check = checkTurnLimit(usage);
    if (!check.allowed)
      return buildGuestResponse(
        Response.json({ error: check.reason }, { status: 403 }),
        guestId,
        isNewGuest
      );

    const isLastTurn = isUserTurn && (usage?.turns ?? 0) === FREE_TURN_LIMIT - 1;
    const llm = await callLLM({
      message,
      history,
      assistantFirst,
      pastSummaries,
      safeLocale,
      isLastTurn,
    });
    if (llm.error) return llm.error;

    updateGuestUsage(adminClient, guestId, today, usage, isUserTurn).catch((e) =>
      console.error("guest_usage upsert error:", e)
    );
    return buildGuestResponse(llm.response, guestId, isNewGuest);
  } catch (err) {
    console.error("chat error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
