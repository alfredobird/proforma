import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Xtillion Portfolio ProForma",
  description: "Monthly portfolio and project proforma builder."
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
