import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kasa bez zarządu",
  description:
    "Kasa zapomogowo-pożyczkowa bez zarządu i skarbnika: oszczędności trzyma program na Solanie, pożyczki zabezpieczają poręczenia, a zaległe raty egzekwuje kod.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
