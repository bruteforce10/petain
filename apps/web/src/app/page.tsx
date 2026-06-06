/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ImageMarquee } from "../components/ParallaxMarquee";

/* ─────────────────────────────────────────
   DATA
   ───────────────────────────────────────── */

const badgeCategories = [
  "Lebih Cepat",
  "Lebih Akurat",
  "Lebih Kredibel",
  "Berdasarkan Data",
  "Tanpa Feeling",
];

const problems = [
  "Cari kompetitor satu-satu di Google Maps — capek, tidak sistematis",
  "Hasil pencariannya sering campur dari area lain yang tidak relevan",
  "Tidak ada gambaran seberapa ramai atau sepi pasar di area itu",
  "Susah tahu apakah harga yang direncanakan masih masuk akal",
  "Akhirnya keputusan tetap pakai feeling",
];

const solutionPoints = [
  "Sudah berapa banyak usaha sejenis di area itu",
  "Mana yang kuat, mana yang lemah",
  "Jam tersibuk di area tersebut",
  "Kisaran harga yang berlaku di pasar",
  "Apakah masih ada celah atau areanya sudah terlalu padat",
];

interface Feature {
  icon: string;
  title: string;
  description: string;
  details: string[];
  image?: string;
  extra?: string;
}

const features: Feature[] = [
  {
    icon: "🔍",
    title: "Riset Kompetitor dari Google Maps",
    description:
      "Petain otomatis kumpulkan data usaha lokal di area yang kamu pilih — tanpa perlu klik satu-satu secara manual.",
    details: [
      "Riset sepuasnya — tidak ada batasan jumlah usaha yang bisa dikumpulkan.",
    ],
    image: "/images/petain/solution-map.png",
  },
  {
    icon: "🎯",
    title: "Filter Hasil Per Kecamatan",
    description:
      'Ini masalah yang sering tidak disadari: kalau kamu cari "laundry Jakarta Selatan" di Google Maps, hasilnya bisa campur dari Depok, Tangerang, atau kecamatan lain yang tidak relevan.',
    details: [
      "Petain punya filter polygon kecamatan — artinya hasil riset hanya menampilkan usaha yang benar-benar ada di kecamatan yang kamu pilih.",
      "6.695 kecamatan seluruh Indonesia sudah tersedia.",
      "Tinggal pilih dari dropdown: Provinsi → Kabupaten/Kota → Kecamatan.",
    ],
    image: "/images/petain/feature-filter.png",
  },
  {
    icon: "📊",
    title: "Laporan Siap Baca & Siap Kirim",
    description: "Hasil riset bisa langsung diexport dalam dua format:",
    details: [
      "CSV — buka di Excel atau Google Sheets, langsung bisa diolah",
      "Laporan HTML — tampilannya rapi, bisa langsung dikirim ke partner atau investor",
      "Ringkasan pasar (rata-rata rating, total kompetitor, yang paling banyak ulasan)",
      "Jam tersibuk dominan di area",
      "Filter berdasarkan rating — tampilkan hanya yang premium kalau perlu",
    ],
    image: "/images/petain/report-export.png",
  },
  {
    icon: "🧠",
    title: "Analisa Peluang Pasar Otomatis",
    description:
      "Setelah riset selesai, Petain langsung hasilkan analisa berdasarkan data yang terkumpul:",
    details: [
      "Kepadatan pasar — area ini sudah penuh, sedang, atau masih terbuka?",
      "Kekuatan kompetitor — rata-rata rating dan seberapa banyak yang sudah punya pelanggan loyal",
      "Estimasi permintaan — dilihat dari volume ulasan di area tersebut",
      "Peluang yang terlewat — usaha dengan rating bagus tapi belum banyak dikenal",
      "Jam tersibuk area — berguna untuk rencanakan operasional atau promosi",
      "Rekomendasi langkah — disesuaikan per jenis usaha",
    ],
  },
  {
    icon: "💰",
    title: "Analisa Harga Pasar",
    description:
      "Setelah tahu siapa saja kompetitornya, kamu bisa lanjut ke halaman Analisa Harga — untuk cek apakah harga yang kamu rencanakan masuk akal di pasar tersebut.",
    details: [
      "Berapa banyak kompetitor dan seberapa kuat mereka",
      "Kisaran segmen harga yang berlaku di area itu",
      "Seberapa tinggi permintaan di sana",
      "Masukkan perkiraan biaya produksi + target keuntungan → lihat apakah harga jualmu masih bersaing",
    ],
  },
  {
    icon: "🛒",
    title: "Riset Harga dari Tokopedia",
    description:
      "Selain Google Maps, Petain juga bisa kumpulkan data produk dari Tokopedia — berguna kalau kamu jual produk fisik dan mau tahu harga pasar online.",
    details: [
      "Harga produk sejenis di pasaran",
      "Jumlah produk terjual (gambaran permintaan)",
      "Rating produk dan toko",
      "Lokasi penjual",
    ],
  },
];

const comparisonData = [
  {
    label: "Kumpulkan data kompetitor",
    manual: "Satu-satu, berjam-jam",
    petain: "Otomatis, menit",
  },
  {
    label: "Hasil akurat per kecamatan",
    manual: "❌ Sering meleset",
    petain: "✅ Filter presisi",
  },
  {
    label: "Analisa kepadatan pasar",
    manual: "❌ Kira-kira",
    petain: "✅ Otomatis dari data",
  },
  {
    label: "Laporan siap kirim",
    manual: "❌ Harus buat sendiri",
    petain: "✅ CSV + HTML",
  },
  { label: "Benchmark harga pasar", manual: "❌ Tidak ada", petain: "✅ Ada" },
  {
    label: "Jam tersibuk area",
    manual: "❌ Tidak tahu",
    petain: "✅ Otomatis",
  },
  {
    label: "Riset produk di Tokopedia",
    manual: "❌ Manual",
    petain: "✅ Otomatis",
  },
  { label: "Biaya", manual: "Waktu + tenaga", petain: "Rp45.000 sekali bayar" },
];

const workflowSteps = [
  {
    step: "Step 1",
    title: "Tentukan yang mau diriset",
    text: 'Masukkan jenis usaha dan area yang kamu incar. Contoh: "Laundry di Bekasi Utara", "Kafe di Lowokwaru Malang", "Barbershop di Ciputat".',
  },
  {
    step: "Step 2",
    title: "Petain kumpulkan datanya",
    text: "Petain otomatis buka Google Maps dan kumpulkan data semua usaha sejenis di area tersebut. Kamu bisa tinggal buka tab lain sambil nunggu.",
  },
  {
    step: "Step 3",
    title: "Filter ke kecamatan yang tepat",
    text: "Aktifkan filter kecamatan supaya hasilnya bersih — hanya usaha yang benar-benar ada di area yang kamu incar.",
  },
  {
    step: "Step 4",
    title: "Baca analisa, export laporan",
    text: "Analisa peluang pasar muncul otomatis. Export ke CSV atau laporan HTML. Lanjut ke Analisa Harga kalau butuh validasi harga jual.",
  },
];

const pricingFeatures = [
  "Riset kompetitor dari Google Maps",
  "Filter hasil per kecamatan — 6.695 kecamatan Indonesia",
  "Analisa peluang pasar otomatis",
  "Laporan export CSV + HTML",
  "Summary analytics otomatis (avg rating, top rated, most reviewed)",
  "Analisa harga pasar",
  "Riset produk Tokopedia",
  "Riset sepuasnya — tidak ada batas",
  "Update fitur 6 bulan",
  "Support via WhatsApp",
];

const testimonials = [
  {
    text: "Saya pakai Petain sebelum buka cabang kedua. Ternyata area yang saya incar sudah cukup padat — akhirnya saya pilih kecamatan sebelah yang lebih terbuka. Keputusan yang lebih yakin.",
    author: "Pengguna Early Access, Pemilik Laundry, Tangerang",
  },
  {
    text: "Biasanya riset kompetitor saya lakukan manual seharian. Dengan Petain, 1 jam sudah dapat data lengkap dari 3 kecamatan berbeda.",
    author: "Pengguna Early Access, Konsultan Franchise",
  },
];

const faqs = [
  {
    q: "Apakah perlu keahlian teknis untuk pakai Petain?",
    a: "Tidak sama sekali. Petain dipasang di Chrome dan langsung bisa dipakai — tidak perlu koding atau pengaturan teknis apapun.",
  },
  {
    q: "Datanya dari mana?",
    a: "Langsung dari Google Maps saat riset berjalan — jadi selalu menggunakan data terkini, bukan database yang sudah lama.",
  },
  {
    q: "Apakah aman dipakai?",
    a: "Petain bekerja seperti kamu browsing Google Maps secara manual, hanya jauh lebih cepat dan sistematis. Tersedia pengaturan kecepatan riset untuk menjaga stabilitas.",
  },
  {
    q: "Berapa lama proses risetnya?",
    a: "Untuk 20 usaha di satu kecamatan, sekitar 1–2 menit. Makin banyak data yang dikumpulkan, makin lama — tapi kamu bisa tinggal buka tab lain.",
  },
  {
    q: "Apakah ada batasan jumlah riset?",
    a: "Tidak ada. Kamu bisa riset berulang kali untuk area dan jenis usaha yang berbeda-beda.",
  },
  {
    q: "Update sampai kapan?",
    a: "Update fitur gratis selama 6 bulan dari tanggal pembelian.",
  },
  {
    q: "Kalau ada masalah, bisa hubungi siapa?",
    a: "Support via WhatsApp, respons di hari yang sama di jam kerja.",
  },
];

/* ─────────────────────────────────────────
   COMPONENTS
   ───────────────────────────────────────── */

function AnimatedCategory() {
  const [index, setIndex] = useState(0);
  const [animClass, setAnimClass] = useState("category-enter");

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimClass("category-exit");
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % badgeCategories.length);
        setAnimClass("category-enter");
      }, 400);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      key={index}
      className={`inline-block text-[rgb(0,55,46)] font-semibold ${animClass}`}
    >
      {badgeCategories[index]}
    </span>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgb(0,55,46)]/10">
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="pr-4 text-base font-medium md:text-lg">{q}</span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgb(0,55,46)]/20 text-sm transition-transform ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "mb-5 max-h-40" : "max-h-0"}`}
      >
        <p className="text-[rgb(5,87,72)] leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────── */

export default function Home() {
  const [isLifetime, setIsLifetime] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden  bg-gray-50 text-[rgb(0,55,46)]">
      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav className="sticky top-0 z-50 border-b border-[rgb(0,55,46)]/8  backdrop-blur-md">
        <div className="t22-container-narrow flex items-center justify-between py-3.5">
          <Link href="/" className="flex items-center">
            <img src="/logo.svg" alt="Petain Logo" className="h-8 w-auto" />
          </Link>

          <div className="hidden items-center gap-7 text-sm md:flex">
            {["Fitur", "Cara Kerja", "Harga", "FAQ"].map((item) => (
              <a
                className="text-[rgb(0,55,46)] transition hover:opacity-70"
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                key={item}
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              className="hidden text-sm font-medium text-[rgb(0,55,46)] transition hover:opacity-70 sm:inline"
              href="/login"
            >
              Login
            </Link>
            <a
              className="rounded-full bg-[rgb(0,55,46)] px-5 py-2.5 text-sm font-medium text-[rgb(250,250,240)] transition hover:opacity-90"
              href="#harga"
            >
              🚀 Mulai Riset
            </a>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="pt-16 md:pt-24 bg-gradient-to-b from-gray-50 to-[#f5e9d8]">
        <div className="t22-container-narrow grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left — Text */}
          <div>
            {/* Badge */}
            <div className="mb-6 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-[rgb(0,55,46)]/15 bg-[rgb(238,238,228)] px-3.5 py-1.5 text-xs font-medium tracking-wide">
                🗺️ Riset Bisnis Lokal · <AnimatedCategory />
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Cari Tahu Peluang Bisnis di Area Kamu{" "}
              <span className="text-[#01C07A]">Sebelum Terjun Duluan.</span>
            </h1>

            {/* Body */}
            <p className="mt-5 text-base leading-relaxed text-[rgb(5,87,72)] md:text-lg">
              Petain bantu kamu riset kompetitor, baca kepadatan pasar, dan
              validasi peluang usaha di kecamatan yang kamu incar — langsung
              dari Google Maps, tanpa biaya riset yang mahal.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                className="rounded-full bg-[rgb(0,55,46)] px-7 py-3.5 text-sm font-semibold text-[rgb(250,250,240)] shadow-lg shadow-[rgb(0,55,46)]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                href="#harga"
              >
                🚀 Mulai Riset Sekarang — Rp45.000
              </a>
              <a
                className="flex items-center gap-2 rounded-full border border-[rgb(0,55,46)]/20 px-5 py-3.5 text-sm font-medium transition hover:bg-[rgb(0,55,46)]/5"
                href="#cara-kerja"
              >
                ▶️ Lihat Cara Kerjanya
              </a>
            </div>
          </div>

          {/* Right — Hero Image */}

          <div className="overflow-hidden ">
            <img
              alt="Petain Dashboard — Riset bisnis lokal, analisa kompetitor, peluang pasar"
              className="w-full"
              src="/hiro.webp"
            />
          </div>
        </div>

        {/* Subheadline */}
        <div className="mt-24 md:mt-36 text-center  px-4">
          <p className="font-semibold text-2xl leading-snug sm:leading-relaxed max-w-4xl  mx-auto text-[rgb(5,87,72)]">
            Cocok untuk pemilik UMKM, calon franchisee, dan siapapun yang mau
            buka atau kembangkan usaha dengan data, bukan asumsi.
          </p>
          <ImageMarquee />
        </div>
      </section>

      {/* ═══════════════ PROBLEM ═══════════════ */}
      <section className="bg-[#F8EFE5] md:bg-[#FAECDC] max-md:py-16 sm:pb-24 sm:pt-12 text-[rgb(0,55,46)]">
        <div className="t22-container-narrow max-w-4xl mx-auto px-4">
          <div className="flex justify-center max-md:mb-16">
            <picture>
              <source media="(min-width: 768px)" srcSet="/web-problem.webp" />
              <img
                src="/mobile-problem.webp"
                alt="Masalah riset bisnis manual"
                className="w-full max-w-12xl mx-auto"
              />
            </picture>
          </div>

          <div className="text-left md:text-center">
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.03em] uppercase">
              Buka Usaha Tanpa Riset = Tebak-tebakan.
            </h2>

            <div className="mt-8 space-y-6 text-lg md:text-xl leading-relaxed text-[rgb(0,55,46)]/70 max-w-3xl mx-auto">
              <p>
                Banyak usaha tutup bukan karena produknya jelek — tapi karena
                salah baca pasar. Areanya sudah terlalu padat. Harganya tidak
                kompetitif. Kompetitornya lebih kuat dari yang dikira.
              </p>
              <p>
                Masalahnya, riset pasar yang bener itu butuh waktu lama dan
                biayanya tidak murah. Cari kompetitor satu-satu di Google Maps,
                hasilnya sering campur, dan akhirnya keputusan tetap pakai
                feeling.
              </p>
              <p className="font-bold text-[rgb(0,55,46)]">
                Sekarang, ada cara yang lebih baik.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SOLUTION ═══════════════ */}
      <section className="py-16 md:py-24">
        <div className="t22-container-narrow grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 flex justify-center lg:order-1">
            <img
              alt="Petain — solusi riset pasar otomatis"
              className="max-w-md rounded-2xl border border-[rgb(0,55,46)]/10 shadow-xl"
              src="/images/petain/solution-map.png"
            />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Petain Kasih Kamu Gambaran Pasar yang Jelas —{" "}
              <span className="text-[rgb(5,87,72)]">Dalam Hitungan Menit.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[rgb(5,87,72)] md:text-lg">
              Masukkan jenis usaha dan area yang kamu incar. Petain langsung
              kumpulkan data kompetitor di sana, filter supaya hasilnya akurat
              per kecamatan, dan sajikan dalam laporan yang bisa langsung
              dibaca.
            </p>
            <div className="mt-6 space-y-2.5">
              <p className="text-sm font-semibold">Kamu jadi tahu:</p>
              {solutionPoints.map((p) => (
                <div className="flex items-start gap-2.5" key={p}>
                  <span className="mt-0.5 text-[#91ffb4]">✓</span>
                  <p className="text-sm leading-relaxed text-[rgb(5,87,72)]">
                    {p}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="fitur" className="bg-[rgb(238,238,228)] py-16 md:py-24">
        <div className="t22-container-narrow">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[rgb(5,87,72)]">
              Fitur Utama
            </p>
            <h2 className="mx-auto mt-3 max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Semua yang kamu butuhkan untuk riset pasar lokal
            </h2>
          </div>

          <div className="mt-12 space-y-6">
            {features.map((f, i) => (
              <div
                className={`grid items-center gap-8 rounded-2xl bg-[rgb(250,250,240)] p-6 shadow-sm md:p-8 ${
                  f.image ? "lg:grid-cols-2" : ""
                }`}
                key={f.title}
              >
                <div className={i % 2 !== 0 && f.image ? "lg:order-2" : ""}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(0,55,46)]/10 text-lg">
                      {f.icon}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight">
                      {f.title}
                    </h3>
                  </div>
                  <p className="text-base leading-relaxed text-[rgb(5,87,72)]">
                    {f.description}
                  </p>
                  <div className="mt-4 space-y-2">
                    {f.details.map((d) => (
                      <div className="flex items-start gap-2" key={d}>
                        <span className="mt-1 text-xs text-[rgb(0,55,46)]">
                          ✅
                        </span>
                        <p className="text-sm leading-relaxed text-[rgb(5,87,72)]">
                          {d}
                        </p>
                      </div>
                    ))}
                  </div>
                  {f.extra && (
                    <p className="mt-3 text-sm italic text-[rgb(5,87,72)]/70">
                      {f.extra}
                    </p>
                  )}
                </div>
                {f.image && (
                  <div className={i % 2 !== 0 ? "lg:order-1" : ""}>
                    <img
                      alt={f.title}
                      className="rounded-xl border border-[rgb(0,55,46)]/10"
                      src={f.image}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON ═══════════════ */}
      <section className="py-16 md:py-24">
        <div className="t22-container-narrow">
          <div className="text-center">
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Riset Manual vs Pakai Petain
            </h2>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[540px] overflow-hidden rounded-2xl border border-[rgb(0,55,46)]/10 text-sm">
              <thead>
                <tr className="bg-[rgb(238,238,228)]">
                  <th className="p-4 text-left font-semibold"></th>
                  <th className="p-4 text-center font-semibold text-[rgb(5,87,72)]">
                    Riset Manual
                  </th>
                  <th className="rounded-tr-2xl bg-[rgb(0,55,46)] p-4 text-center font-semibold text-[rgb(250,250,240)]">
                    Petain ✨
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60">
                {comparisonData.map((row) => (
                  <tr
                    className="border-t border-[rgb(0,55,46)]/8"
                    key={row.label}
                  >
                    <td className="p-4 font-medium">{row.label}</td>
                    <td className="p-4 text-center text-[rgb(5,87,72)]/60">
                      {row.manual}
                    </td>
                    <td className="bg-[rgb(0,55,46)]/5 p-4 text-center font-medium text-[rgb(0,55,46)]">
                      {row.petain}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════ WORKFLOW ═══════════════ */}
      <section
        id="cara-kerja"
        className="bg-[rgb(0,55,46)] py-16 text-[rgb(250,250,240)] md:py-24"
      >
        <div className="t22-container-narrow">
          <div className="text-center">
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Empat Langkah, Riset Selesai.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((s, i) => (
              <div
                className="rounded-2xl border border-[rgb(250,250,240)]/10 bg-[rgb(250,250,240)]/5 p-6"
                key={s.title}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#91ffb4] text-base font-bold text-[#00372e]">
                  {i + 1}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(250,250,240)]/50">
                  {s.step}
                </p>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[rgb(250,250,240)]/70">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section id="harga" className="py-16 md:py-24">
        <div className="t22-container-narrow">
          <div className="text-center">
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Investasi Kecil untuk Keputusan Bisnis Besar.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-[rgb(5,87,72)]">
              Daripada rugi jutaan karena salah pilih lokasi atau harga, lebih
              baik riset dengan data akurat. Tool riset kompetitor lain memungut
              Rp499.000/bulan. Di Petain, kamu hanya perlu bayar mulai dari
              harga 2 cangkir kopi.
            </p>

            {/* Toggle */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <span
                className={`text-sm font-medium transition ${!isLifetime ? "text-[rgb(0,55,46)]" : "text-[rgb(5,87,72)]/60"}`}
              >
                Akses 3 Bulan
              </span>
              <button
                onClick={() => setIsLifetime(!isLifetime)}
                className="relative inline-flex h-8 w-14 items-center rounded-full bg-[rgb(0,55,46)] transition-colors focus:outline-none"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-[#91ffb4] transition ${isLifetime ? "translate-x-7" : "translate-x-1"}`}
                />
              </button>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium transition ${isLifetime ? "text-[rgb(0,55,46)]" : "text-[rgb(5,87,72)]/60"}`}
                >
                  Permanen
                </span>
                <span className="rounded-full bg-[#ffd53e] px-2 py-0.5 text-[10px] font-bold text-[#00372e]">
                  BEST VALUE
                </span>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-lg">
            <div className="relative overflow-hidden rounded-3xl border-2 border-[rgb(0,55,46)] bg-white p-8 shadow-xl md:p-10 transition-all duration-300">
              {/* Badge */}
              <div className="absolute right-6 top-6 rounded-full bg-[#ffd53e] px-3 py-1 text-xs font-bold text-[#00372e]">
                HEMAT {isLifetime ? "80%" : "70%"}
              </div>

              <h3 className="text-2xl font-bold">
                Petain Pro {isLifetime ? "Lifetime" : "Basic"}
              </h3>
              <div className="mt-3 flex items-baseline gap-3 transition-all duration-300">
                <span className="text-lg text-[rgb(5,87,72)]/50 line-through">
                  {isLifetime ? "Rp750.000" : "Rp149.000"}
                </span>
                <span className="text-4xl font-bold text-[rgb(0,55,46)]">
                  {isLifetime ? "Rp150.000" : "Rp45.000"}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[rgb(5,87,72)]">
                {isLifetime
                  ? "Bayar sekali, akses selamanya tanpa batas waktu."
                  : "Akses penuh selama 3 bulan, tanpa perpanjangan otomatis."}
              </p>

              <div className="mt-6 space-y-2.5">
                {pricingFeatures.map((f, idx) => (
                  <div className="flex items-start gap-2.5" key={idx}>
                    <span className="mt-0.5 text-[rgb(0,55,46)]">✅</span>
                    <p className="text-sm">{f}</p>
                  </div>
                ))}
              </div>

              <a
                className="mt-8 flex w-full items-center justify-center rounded-full bg-[rgb(0,55,46)] py-4 text-base font-semibold text-[rgb(250,250,240)] shadow-lg shadow-[rgb(0,55,46)]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                href="#"
              >
                🚀 Ambil Sekarang — {isLifetime ? "Rp150.000" : "Rp45.000"}
              </a>

              <p className="mt-4 text-center text-xs text-[rgb(5,87,72)]/60">
                🔒 Pembayaran aman · QRIS · Transfer Bank · E-Wallet · Garansi 3
                hari
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      <section className="bg-[rgb(238,238,228)] py-16 md:py-24">
        <div className="t22-container-narrow">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[rgb(5,87,72)]">
              Testimoni
            </p>
            <h2 className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Dari Pengguna Early Access
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {testimonials.map((t) => (
              <blockquote
                className="rounded-2xl bg-[rgb(250,250,240)] p-6 shadow-sm md:p-8"
                key={t.author}
              >
                <div className="mb-4 text-2xl text-[#ffd53e]">★★★★★</div>
                <p className="text-base leading-relaxed text-[rgb(5,87,72)]">
                  &ldquo;{t.text}&rdquo;
                </p>
                <p className="mt-4 text-sm font-medium text-[rgb(0,55,46)]">
                  — {t.author}
                </p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="py-16 md:py-24">
        <div className="t22-container-narrow">
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
                Pertanyaan yang Sering Ditanyakan
              </h2>
            </div>

            <div className="mt-10">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ CLOSING CTA ═══════════════ */}
      <section className="bg-[rgb(0,55,46)] py-16 text-[rgb(250,250,240)] md:py-24">
        <div className="t22-container-narrow text-center">
          <h2 className="mx-auto max-w-2xl text-[clamp(1.8rem,4.5vw,3.2rem)] font-bold leading-[1.1] tracking-[-0.03em]">
            Jangan Buka Usaha Cuma Bermodal Feeling.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[rgb(250,250,240)]/75">
            Data kompetitor, kepadatan pasar, dan validasi harga — semua bisa
            kamu punya sebelum ambil keputusan.
          </p>
          <a
            className="mt-8 inline-flex rounded-full bg-[rgb(250,250,240)] px-8 py-4 text-base font-semibold text-[rgb(0,55,46)] shadow-lg transition hover:-translate-y-0.5"
            href="#harga"
          >
            🚀 Mulai Riset dengan Petain — Rp45.000
          </a>
          <p className="mt-4 text-sm text-[rgb(250,250,240)]/50">
            Sekali bayar. Tidak ada langganan. Langsung bisa dipakai hari ini.
          </p>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-[rgb(0,55,46)]/10 bg-[rgb(250,250,240)] py-10">
        <div className="t22-container-narrow">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center">
                <img src="/logo.svg" alt="Petain Logo" className="h-8 w-auto" />
              </Link>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[rgb(5,87,72)]">
                Tool riset pasar lokal untuk UMKM, calon franchisee, dan
                siapapun yang ingin memvalidasi peluang usaha dengan data.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Produk</h3>
              <div className="grid gap-2 text-sm text-[rgb(5,87,72)]">
                <a className="hover:text-[rgb(0,55,46)]" href="#fitur">
                  Fitur
                </a>
                <a className="hover:text-[rgb(0,55,46)]" href="#harga">
                  Harga
                </a>
                <a className="hover:text-[rgb(0,55,46)]" href="#cara-kerja">
                  Cara Kerja
                </a>
                <a className="hover:text-[rgb(0,55,46)]" href="#faq">
                  FAQ
                </a>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Lainnya</h3>
              <div className="grid gap-2 text-sm text-[rgb(5,87,72)]">
                <a className="hover:text-[rgb(0,55,46)]" href="#">
                  Kebijakan Privasi
                </a>
                <a className="hover:text-[rgb(0,55,46)]" href="#">
                  Syarat & Ketentuan
                </a>
                <a className="hover:text-[rgb(0,55,46)]" href="#">
                  Hubungi Kami
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-[rgb(0,55,46)]/10 pt-6 text-center text-xs text-[rgb(5,87,72)]/60">
            © 2024 Petain. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
