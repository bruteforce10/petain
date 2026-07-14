"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { AuthShell } from "@/components/auth/AuthShell";

const inputClass =
  "w-full rounded-2xl border border-hijau-rimba/15 bg-white px-4 py-3 text-[15px] text-hijau-rimba placeholder:text-teal-kedalaman/80 outline-none transition-[border-color,box-shadow] duration-150 focus:border-hijau-sinyal focus:ring-2 focus:ring-hijau-sinyal/30";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErr(translateAuthError(error.message));
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErr("Tidak bisa terhubung ke server. Periksa koneksi internetmu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.025em] text-hijau-rimba">
        Masuk ke Petain
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-teal-kedalaman">
        Lanjutkan risetmu — data kompetitor dan analisa pasar menunggu di
        dashboard.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-hijau-rimba"
          >
            Email
          </label>
          <input
            id="email"
            className={inputClass}
            type="email"
            autoComplete="email"
            placeholder="kamu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-hijau-rimba"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              className={`${inputClass} pr-12`}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Minimal 6 karakter"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-teal-kedalaman transition-colors duration-150 hover:bg-hijau-rimba/5 hover:text-hijau-rimba focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hijau-sinyal"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" aria-hidden />
              ) : (
                <Eye className="h-[18px] w-[18px]" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {err && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
          >
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-hijau-rimba px-7 py-3.5 text-[15px] font-bold text-ivory-peta transition duration-150 hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hijau-sinyal focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-peta disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {busy ? (
            <>
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:hidden"
                aria-hidden
              />
              Memproses…
            </>
          ) : (
            "Masuk"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-teal-kedalaman">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="rounded-sm font-semibold text-hijau-rimba underline decoration-hijau-sinyal/40 underline-offset-4 transition-colors duration-150 hover:decoration-hijau-sinyal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hijau-sinyal focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-peta"
        >
          Daftar sekarang
        </Link>
      </p>
    </AuthShell>
  );
}
