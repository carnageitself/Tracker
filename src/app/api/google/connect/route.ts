import { NextResponse, type NextRequest } from "next/server";
import { consentUrl, googleConfigured } from "@/lib/calendar/google";
import { createClient } from "@/lib/supabase/server";

export const OAUTH_STATE_COOKIE = "google_oauth_state";

/** Kicks off the Google consent screen. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;

  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/integrations?error=google_not_configured`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Random state, echoed back by Google and compared in the callback.
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(consentUrl(origin, state));

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return response;
}
