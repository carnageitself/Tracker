import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { SetupNotice } from "@/components/SetupNotice";
import { getLeads, getWorkspace } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home({ searchParams }: PageProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const workspace = await getWorkspace();
  // Middleware normally catches this; the guard keeps the page honest on its own.
  if (!workspace) redirect("/login");

  const { list } = await searchParams;
  const requested = Array.isArray(list) ? list[0] : list;

  // An unknown or revoked list id falls back to your own rather than erroring.
  const activeList =
    workspace.lists.find((entry) => entry.ownerId === requested) ?? workspace.lists[0];

  const leads = await getLeads(activeList.ownerId);

  return <Dashboard workspace={workspace} activeList={activeList} leads={leads} />;
}
