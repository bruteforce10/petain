"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErr(error.message);
        return;
      }
      // Session present immediately -> email confirmation is off, go straight in.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      // No session -> Supabase sent a confirmation email.
      setInfo("Cek email kamu untuk konfirmasi akun, lalu log in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Daftar Petain</h1>
        <p className="text-sm text-gray-500">Buat akun untuk mulai riset.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            type="password"
            placeholder="password (min. 6 karakter)"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full rounded bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:bg-gray-400"
            type="submit"
            disabled={busy}
          >
            {busy ? "Working…" : "Daftar"}
          </button>
          {err && <p className="text-xs text-red-600">{err}</p>}
          {info && <p className="text-xs text-green-700">{info}</p>}
        </form>
        <p className="text-center text-sm text-gray-500">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
