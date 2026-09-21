import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { getConnections } from "@/lib/calendar/connections";
import { googleConfigured } from "@/lib/calendar/google";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { IntegrationsPanel } from "./IntegrationsPanel";

export default async function IntegrationsPage({ searchParams }: PageProps<"/integrations">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const connections = await getConnections();
  const params = await searchParams;
  const asText = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="text-sm text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
      >
        ← Back to leads
      </Link>

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        Integrations
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Pull contacts straight off your calendar into your lead list.
      </p>

      <IntegrationsPanel
        userId={user.id}
        connections={connections}
        googleConfigured={googleConfigured()}
        errorCode={asText(params.error) ?? null}
        connectedCode={asText(params.connected) ?? null}
      />
    </main>
  );
}
