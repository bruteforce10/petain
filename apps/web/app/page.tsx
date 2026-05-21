import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">TerraMap</h1>
      <p className="max-w-xl text-lg text-gray-600">
        Scrape products from Tokopedia &amp; Shopee and places from Google Maps with the browser
        extension, then browse everything you&apos;ve saved here.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
      >
        View saved data →
      </Link>
    </main>
  );
}
