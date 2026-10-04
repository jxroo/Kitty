import type { Metadata } from "next";
import { preload } from "react-dom";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://web-production-ad49f.up.railway.app"),
  title: "Kasa bez zarządu",
  description:
    "Kasa zapomogowo-pożyczkowa bez zarządu i skarbnika: oszczędności trzyma program na Solanie, pożyczki zabezpieczają poręczenia, a zaległe raty egzekwuje kod.",
};

// Inter sets almost every word on the page, and Polish text needs both of its subsets.
const PRELOAD_FONTS = ["/fonts/inter-normal-latin.woff2", "/fonts/inter-normal-latin-ext.woff2"];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  for (const href of PRELOAD_FONTS) preload(href, { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html lang="pl">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
