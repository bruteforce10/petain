/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ImageMarquee } from "../components/ParallaxMarquee";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

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

/* Dirender dua kali di section solusi: sebelum kartu gambar (≥md, rata kiri)
   dan sesudahnya (mobile, terpusat). Hanya satu yang tampil per breakpoint. */
function SolutionChecklist({
  align = "center",
}: {
  align?: "center" | "left";
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <p
        className={`text-base font-extrabold text-center
        }`}
      >
        Kamu jadi tahu:
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {solutionPoints.map((p) => (
          <div className="flex items-start gap-3" key={p}>
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[#91ffb4] text-[13px] font-extrabold text-[#00372E]">
              ✓
            </span>
            <p className="text-left text-base leading-relaxed text-[#055748]">
              {p}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <section id="solusi" className="bg-[#FBFAF3] max-sm:pt-16 pb-16 md:pb-24">
        <ContainerScroll
          titleComponent={
            <>
              <h2 className="mx-auto max-w-[720px] text-balance text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-[1.12] tracking-[-0.03em]">
                Petain Kasih Kamu Gambaran Pasar yang Jelas —{" "}
                <span className="text-[#01C07A]">Dalam Hitungan Menit.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[620px] text-base leading-relaxed text-[#055748]">
                Masukkan jenis usaha dan area yang kamu incar. Petain langsung
                kumpulkan data kompetitor di sana, filter supaya hasilnya akurat
                per kecamatan, dan sajikan dalam laporan yang bisa langsung
                dibaca.
              </p>
              <div className="mt-8 hidden md:block">
                <SolutionChecklist align="left" />
              </div>
            </>
          }
        >
          <img
            alt="Dashboard Petain menampilkan peta kepadatan kompetitor per kecamatan"
            className="block h-auto w-full"
            src="/images/petain/solution-map.png"
            loading="lazy"
            draggable={false}
          />
        </ContainerScroll>

        <div className="t22-container-narrow mt-8 md:hidden">
          <SolutionChecklist />
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="fitur" className="bg-white py-16 md:py-24">
        <div className="t22-container-narrow">
          <div className="mx-auto max-w-[660px] text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#01C07A]">
              Fitur Utama
            </p>
            <h2 className="mt-3.5 text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-[1.12] tracking-[-0.03em]">
              Semua yang kamu butuhkan untuk riset pasar lokal
            </h2>
          </div>

          {features.slice(0, 3).map((f, i) => {
            const isImageLeft = i % 2 !== 0;
            const frame = isImageLeft
              ? {
                  card: "bg-[linear-gradient(150deg,#f7ecdc,#f1e0c9)] shadow-[0_30px_60px_-34px_rgba(120,70,20,0.4)]",
                  dot: "bg-[rgba(120,70,20,0.16)]",
                  img: "shadow-[0_14px_30px_-18px_rgba(120,70,20,0.5)]",
                }
              : {
                  card: "bg-[linear-gradient(150deg,#d9f6e3,#c7eed8)] shadow-[0_30px_60px_-34px_rgba(0,55,46,0.45)]",
                  dot: "bg-[rgba(0,55,46,0.18)]",
                  img: "shadow-[0_14px_30px_-18px_rgba(0,55,46,0.5)]",
                };
            return (
              <div
                className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
                key={f.title}
              >
                <div className={isImageLeft ? "lg:order-2" : ""}>
                  <div className="inline-flex items-center gap-3">
                    <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[15px] bg-[#00372E] text-[25px] text-[#91ffb4]">
                      {f.icon}
                    </span>
                    <span className="text-[13px] font-extrabold tracking-[0.14em] text-[#01C07A]">
                      FITUR 0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[26px] font-extrabold leading-[1.15] tracking-[-0.025em]">
                    {f.title}
                  </h3>
                  <p className="mt-3.5 text-base leading-relaxed text-[#055748]">
                    {f.description}
                  </p>
                  {f.details.length === 1 ? (
                    <p className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-[#91ffb4] px-[18px] py-[11px] text-[15px] font-bold text-[#00372E]">
                      <span className="font-extrabold">✓</span> {f.details[0]}
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {f.details.map((d) => (
                        <li
                          className="flex gap-2.5 text-[15px] text-[#055748]"
                          key={d}
                        >
                          <span className="font-extrabold text-[#01C07A]">
                            ✓
                          </span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div
                  className={`rounded-[26px] p-[22px] ${frame.card} ${isImageLeft ? "lg:order-1" : ""}`}
                >
                  <div className="flex gap-[7px] px-1 pb-3.5 pt-1">
                    <span
                      className={`h-[11px] w-[11px] rounded-full ${frame.dot}`}
                    />
                    <span
                      className={`h-[11px] w-[11px] rounded-full ${frame.dot}`}
                    />
                    <span
                      className={`h-[11px] w-[11px] rounded-full ${frame.dot}`}
                    />
                  </div>
                  <img
                    alt={f.title}
                    className={`w-full rounded-[14px] ${frame.img}`}
                    src={f.image}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-16 grid gap-[22px] md:grid-cols-3">
            {features.slice(3).map((f, i) => (
              <div
                className="relative overflow-hidden rounded-[22px] border border-[rgb(0,55,46)]/8 bg-white px-[30px] py-8 transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgba(0,55,46,0.28)]"
                key={f.title}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#01C07A,#91ffb4)]" />
                <div className="flex items-center justify-between">
                  <div className="grid h-[52px] w-[52px] place-items-center rounded-[15px] bg-[#ecfdf3] text-[25px]">
                    {f.icon}
                  </div>
                  <span className="text-xs font-extrabold tracking-[0.12em] text-[rgb(0,55,46)]/25">
                    0{i + 4}
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-extrabold tracking-[-0.02em]">
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#055748]">
                  {f.description}
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {f.details.map((d) => (
                    <li
                      className="flex gap-[9px] text-[13.5px] text-[#055748]"
                      key={d}
                    >
                      <span className="font-extrabold text-[#01C07A]">·</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Ringkasan total nilai bonus */}
          <div className="mx-auto mt-14 max-w-3xl rounded-[28px] bg-[#00372E] px-6 py-10 text-center sm:px-10 md:mt-20 md:py-12">
            <span className="inline-block rounded-full bg-[#FFD53E] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#00372E]">
              Total Nilai Bonus
            </span>
            <p className="mt-4 text-balance text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#FAFAF0]">
              Rp 2.099.000
            </p>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[#FAFAF0]/85">
              Kamu dapatkan{" "}
              <span className="font-extrabold text-[#91ffb4]">GRATIS</span>,
              sudah termasuk dalam satu harga lifetime di bawah ini!
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON ═══════════════ */}
      <section className="bg-[#FBFAF3] py-16 md:py-24">
        <div className="mx-auto w-[min(920px,calc(100%-32px))]">
          <h2 className="text-center text-[clamp(1.8rem,4vw,2.7rem)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Riset Manual <span className="text-[#9ca3af]">vs</span> Pakai Petain
          </h2>

          <div className="mt-11 overflow-x-auto">
            <div className="min-w-[560px] overflow-hidden rounded-3xl border border-[rgb(0,55,46)]/8 bg-white shadow-[0_24px_60px_-34px_rgba(0,55,46,0.35)]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr]">
                <div className="px-6 py-5" />
                <div className="border-l border-[rgb(0,55,46)]/8 px-6 py-5 text-center text-[15px] font-bold text-[#6b7280]">
                  Riset Manual
                </div>
                <div className="bg-[#ecfdf3] px-6 py-5 text-center text-[15px] font-extrabold text-[#00372E]">
                  Petain ✨
                </div>
              </div>
              {comparisonData.map((row) => (
                <div
                  className="grid grid-cols-[1.4fr_1fr_1fr] border-t border-[rgb(0,55,46)]/8"
                  key={row.label}
                >
                  <div className="px-6 py-4 text-[14.5px] font-semibold text-[#00372E]">
                    {row.label}
                  </div>
                  <div className="border-l border-[rgb(0,55,46)]/8 px-6 py-4 text-center text-sm text-[#9ca3af]">
                    {row.manual}
                  </div>
                  <div className="bg-[#f6fef9] px-6 py-4 text-center text-sm font-semibold text-[#047857]">
                    {row.petain}
                  </div>
                </div>
              ))}
            </div>
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
      <section id="harga" className="bg-[#FBFAF3] py-16 md:py-24">
        <div className="mx-auto w-[min(900px,calc(100%-32px))] text-center">
          <h2 className="text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Investasi Kecil untuk Keputusan Bisnis Besar.
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[17px] leading-relaxed text-[#055748]">
            Daripada rugi jutaan karena salah pilih lokasi atau harga, lebih
            baik riset dengan data akurat. Tool riset kompetitor lain memungut
            Rp499.000/bulan. Di Petain, kamu hanya perlu bayar mulai dari harga
            2 cangkir kopi.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center rounded-full bg-[#EEEEE4] p-[5px]">
            <button
              onClick={() => setIsLifetime(false)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-[22px] py-[11px] text-[14.5px] font-bold transition ${
                isLifetime
                  ? "text-[#055748]"
                  : "bg-[#00372E] text-[#FAFAF0] shadow-[0_4px_12px_-4px_rgba(0,55,46,0.3)]"
              }`}
            >
              Akses 3 Bulan
            </button>
            <button
              onClick={() => setIsLifetime(true)}
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-[22px] py-[11px] text-[14.5px] font-bold transition ${
                isLifetime
                  ? "bg-[#00372E] text-[#FAFAF0] shadow-[0_4px_12px_-4px_rgba(0,55,46,0.3)]"
                  : "text-[#055748]"
              }`}
            >
              Permanen
              <span className="whitespace-nowrap rounded-full bg-[#ffd53e] px-[7px] py-[3px] text-[10px] font-extrabold tracking-[0.04em] text-[#00372E]">
                BEST VALUE
              </span>
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="mx-auto mt-10 w-[min(480px,calc(100%-32px))]">
          <div className="relative overflow-hidden rounded-[28px] bg-[#00372E] p-8 text-left text-[#FAFAF0] shadow-[0_40px_80px_-40px_rgba(0,55,46,0.6)] md:p-10">
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap rounded-full bg-[#ffd53e] px-3 py-[5px] text-xs font-extrabold text-[#00372E]">
                HEMAT {isLifetime ? "80%" : "70%"}
              </span>
              <span className="text-sm font-bold tracking-[0.02em] text-[#91ffb4]">
                Petain Pro {isLifetime ? "Lifetime" : "Basic"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2">
              <span className="text-5xl font-extrabold leading-none tracking-[-0.03em]">
                {isLifetime ? "Rp150.000" : "Rp45.000"}
              </span>
              <span className="text-lg text-[rgb(250,250,240)]/50 line-through">
                {isLifetime ? "Rp750.000" : "Rp149.000"}
              </span>
            </div>
            <p className="mt-2.5 text-[14.5px] text-[rgb(250,250,240)]/70">
              {isLifetime
                ? "Bayar sekali, akses selamanya tanpa batas waktu."
                : "Akses penuh selama 3 bulan, tanpa perpanjangan otomatis."}
            </p>

            <a
              className="mt-6 block rounded-full bg-[#91ffb4] p-4 text-center text-base font-extrabold text-[#00372E] shadow-[0_16px_36px_-14px_rgba(145,255,180,0.5)] transition hover:-translate-y-0.5"
              href="#"
            >
              🚀 Ambil Sekarang — {isLifetime ? "Rp150.000" : "Rp45.000"}
            </a>

            <ul className="mt-7 flex flex-col gap-[11px]">
              {pricingFeatures.map((f) => (
                <li
                  className="flex gap-[11px] text-[14.5px] text-[rgb(250,250,240)]/90"
                  key={f}
                >
                  <span className="font-extrabold text-[#91ffb4]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-5 text-center text-[13.5px] text-[#6b7280]">
            🔒 Pembayaran aman · QRIS · Transfer Bank · E-Wallet · Garansi 3
            hari
          </p>
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
      <section className="relative overflow-hidden bg-[#00372E] py-16 text-center text-[rgb(250,250,240)] md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_50%_100%,rgba(145,255,180,0.16),transparent_70%)]" />
        <div className="relative mx-auto max-w-[720px] px-6">
          <h2 className="text-[clamp(2rem,4.4vw,3.1rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#FAFAF0]">
            Jangan Buka Usaha Cuma Bermodal Feeling.
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-lg leading-relaxed text-[rgb(250,250,240)]/80">
            Data kompetitor, kepadatan pasar, dan validasi harga — semua bisa
            kamu punya sebelum ambil keputusan.
          </p>
          <a
            className="mt-8 inline-block rounded-full bg-[#91ffb4] px-8 py-[18px] text-[17px] font-extrabold text-[#00372E] shadow-[0_18px_44px_-14px_rgba(145,255,180,0.5)] transition hover:-translate-y-0.5"
            href="#harga"
          >
            🚀 Mulai Riset dengan Petain — Rp45.000
          </a>
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
