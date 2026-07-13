import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this route; this is the second layer + email source.
  if (!user) redirect("/login");

  return (
    <DashboardShell email={user.email ?? ""} active="dashboard">
      <DashboardClient />
    </DashboardShell>
  );
}
