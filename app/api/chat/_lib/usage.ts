import { GUEST_COOKIE_MAX_AGE, GUEST_COOKIE_NAME } from "@/lib/freePlanUsage";
import type { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UsageRow } from "./types";

export async function updateUserUsage(
  userId: string,
  today: string,
  usage: UsageRow,
  isUserTurn: boolean
): Promise<void> {
  if (!isUserTurn) return;
  const supabase = await createClient();
  await supabase.from("daily_usage").upsert(
    {
      user_id: userId,
      date: today,
      turns: (usage?.turns ?? 0) + 1,
    },
    { onConflict: "user_id,date" }
  );
}

export async function updateGuestUsage(
  adminClient: ReturnType<typeof createAdminClient>,
  guestId: string,
  today: string,
  usage: UsageRow,
  isUserTurn: boolean
): Promise<void> {
  if (!isUserTurn) return;
  await adminClient.from("guest_usage").upsert(
    {
      guest_id: guestId,
      date: today,
      turns: (usage?.turns ?? 0) + 1,
    },
    { onConflict: "guest_id,date" }
  );
}

export function buildGuestResponse(
  response: Response,
  guestId: string,
  isNewGuest: boolean
): Response {
  if (!isNewGuest) {
    return response;
  }

  const cookieValue = `${GUEST_COOKIE_NAME}=${guestId}; HttpOnly; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE}; SameSite=Lax`;
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Set-Cookie", cookieValue);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
