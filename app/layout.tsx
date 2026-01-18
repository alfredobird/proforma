import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proforma Builder",
  description: "Build project and portfolio proformas (Jan–Dec) with weekly rollups."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
