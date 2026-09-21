import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchAccountEmail } from "@/lib/calendar/google";
import { createClient } from "@/lib/supabase/server";
import { OAUTH_STATE_COOKIE } from "../connect/route";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/integrations?error=${reason}`);
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;

  if (searchParams.get("error")) return fail(origin, "google_denied");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // Reject anything that didn't originate from our own connect route.
  if (!code || !state || !expected || state !== expected) {
    return fail(origin, "google_state_mismatch");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokens = await exchangeCode(code, origin);
    const accountEmail = await fetchAccountEmail(tokens.accessToken);

    const { error } = await supabase.from("calendar_connections").upsert(
      {
        user_id: user.id,
        provider: "google" as const,
        access_token: tokens.accessToken,
        // Google omits the refresh token on re-consent in some cases; leaving
        // the column out preserves whatever is already stored.
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
        expires_at: tokens.expiresAt,
        account_email: accountEmail,
      },
      { onConflict: "user_id,provider" },
    );

    if (error) return fail(origin, "google_save_failed");
  } catch {
    return fail(origin, "google_exchange_failed");
  }

  const response = NextResponse.redirect(`${origin}/integrations?connected=google`);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
