import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">{PRODUCT_NAME}</p>
          <p className="mt-2 text-sm text-muted">{PRODUCT_TAGLINE}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
