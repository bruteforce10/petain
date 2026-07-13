import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { KalkulatorHppClient } from "./KalkulatorHppClient";

export const metadata: Metadata = {
  title: "Kalkulator HPP | Petain",
  description:
    "Hitung Harga Pokok Produksi, tentukan harga jual ideal, dan analisis profit & BEP.",
};

export default async function KalkulatorHppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy sudah menjaga route ini; lapisan kedua + sumber email untuk shell.
  if (!user) redirect("/login");

  return (
    <DashboardShell email={user.email ?? ""} active="kalkulator-hpp" wide>
      <KalkulatorHppClient />
    </DashboardShell>
  );
}
