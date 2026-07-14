import Link from "next/link";
import Image from "next/image";

/**
 * Split-screen shell untuk halaman auth (login/register): panel form di kiri
 * di atas kertas Ivory Peta, foto cover dengan scrim Hijau Rimba di kanan.
 * Panel foto hanya dirender ≥lg; di bawah itu halaman tetap ringan untuk HP.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh bg-ivory-peta">
      <div className="flex w-full flex-col px-6 py-6 sm:px-10 lg:w-[46%] lg:px-14">
        <Link
          href="/"
          className="w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hijau-sinyal focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-peta"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
          <img src="/logo.svg" alt="Petain" className="h-8 w-auto" />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div className="hidden p-3 lg:block lg:flex-1">
        <div className="relative h-full overflow-hidden rounded-[28px] bg-hijau-rimba">
          <Image
            src="/cover-login.png"
            alt="Pemilik UMKM merencanakan usahanya bersama di ruang kerja"
            fill
            priority
            sizes="(min-width: 1024px) 54vw, 1px"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-hijau-rimba/90 via-hijau-rimba/15 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-10">
            <p className="max-w-md text-balance text-2xl font-bold leading-snug tracking-[-0.02em] text-ivory-peta">
              &ldquo;Jangan buka usaha cuma bermodal feeling.&rdquo;
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ivory-peta/85">
              Data kompetitor nyata dari Google Maps, presisi per kecamatan —
              6.695 kecamatan di seluruh Indonesia.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
