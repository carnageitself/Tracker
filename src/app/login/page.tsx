import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/SetupNotice";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Lead Tracker</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Sign in to your list, or create an account.
      </p>
      {/* LoginForm reads the ?next= param, so it needs a boundary to
          prerender this route statically. */}
      <Suspense fallback={<div className="mt-6 h-64" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
