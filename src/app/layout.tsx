import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saudi Sales & Quotation Management System",
  description:
    "Offline sales, quotation, invoice and payment management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}