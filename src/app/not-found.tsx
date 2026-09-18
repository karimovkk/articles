import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-text">404</p>
      <p className="text-muted">Sahifa topilmadi.</p>
      <Link href="/library" className="text-accent underline">
        Kutubxonaga qaytish
      </Link>
    </div>
  );
}
