import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kitty – the group kitty, minus the treasurer",
  description:
    "A mutual savings and loan fund with no board and no treasurer: a Solana program holds the savings, guarantees secure the loans, and code collects overdue installments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-700 antialiased">{children}</body>
    </html>
  );
}
