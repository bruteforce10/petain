import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { AgentAiClient } from "./AgentAiClient";

export const metadata: Metadata = {
  title: "Agent AI | Petain",
  description:
    "Tanya jawab dengan Agent AI Petain — bisa lampirkan gambar dan file teks, didukung Gemini.",
};

export default async function AgentAiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy sudah menjaga route ini; lapisan kedua + sumber email untuk shell.
  if (!user) redirect("/login");

  return (
    <DashboardShell email={user.email ?? ""} active="agent-ai">
      <AgentAiClient />
    </DashboardShell>
  );
}
