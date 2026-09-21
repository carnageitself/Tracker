"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BTN_PRIMARY, INPUT, LABEL } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data: result, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signUpError) throw signUpError;

        // With email confirmation on, there's no session until they click the link.
        if (!result.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div
        role="group"
        aria-label="Sign in or sign up"
        className="mt-6 flex gap-1 rounded-lg border border-hairline bg-surface p-1"
      >
        {(["signin", "signup"] as Mode[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === value
                ? "bg-btn text-btn-fg"
                : "text-ink-secondary hover:bg-wash hover:text-ink"
            }`}
          >
            {value === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          className={INPUT}
        />

        <label htmlFor="password" className={`${LABEL} mt-4`}>
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={INPUT}
        />

        {error ? (
          <p
            role="alert"
            className="mt-3 text-sm"
            style={{ color: "var(--status-critical)" }}
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-ink-secondary">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className={`${BTN_PRIMARY} mt-5 w-full`}
        >
          {pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </>
  );
}
