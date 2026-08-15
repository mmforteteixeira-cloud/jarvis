import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-ink-faint">404</p>
      <p className="text-ink-dim">This view doesn't exist.</p>
      <Link href="/" className="text-sm text-accent underline underline-offset-4">
        Return to Dashboard
      </Link>
    </div>
  );
}
