const CODE = "rounded bg-wash px-1.5 py-0.5 font-mono text-[13px] text-ink";

const STEPS = [
  <>
    Create a project at{" "}
    <a
      href="https://supabase.com/dashboard"
      className="text-ink underline underline-offset-4"
    >
      supabase.com/dashboard
    </a>
    .
  </>,
  <>
    In the SQL Editor, run <code className={CODE}>supabase/migrations/0001_init.sql</code>{" "}
    then <code className={CODE}>0002_calendar.sql</code>.
  </>,
  <>
    Create <code className={CODE}>.env.local</code> in the project root with{" "}
    <code className={CODE}>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
    <code className={CODE}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, from Settings → API.
    Use the <em>publishable</em> key, never the secret one.
  </>,
  <>
    Restart <code className={CODE}>npm run dev</code>.
  </>,
];

/** Shown instead of the app when .env.local hasn't been filled in yet. */
export function SetupNotice() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        Finish setting up Supabase
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">
        The app needs a Supabase project before it can sign anyone in.
      </p>

      <ol className="mt-6 space-y-3">
        {STEPS.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm text-ink-secondary">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline text-xs text-ink">
              {index + 1}
            </span>
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm text-ink-muted">
        Google Calendar and Calendly are optional — see the README to enable them.
      </p>
    </main>
  );
}
