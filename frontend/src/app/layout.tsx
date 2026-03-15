import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solemtrix – Smart Cane Tracking",
  description:
    "Real-time smart cane tracking platform for caregivers and visually impaired users.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className="dark">
      <body className="h-full bg-surface-0 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
