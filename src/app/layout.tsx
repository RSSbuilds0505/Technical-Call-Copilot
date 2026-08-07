import type { Metadata } from "next";
import "./globals.css";

// Branding is centralized here and in src/lib/branding.ts so the product
// name/logo can be swapped without touching feature code.
import { PRODUCT_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Real-time decision support for technical customer calls.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
