import type { Metadata, Viewport } from "next";
import "./globals.css";
import CapacitorInit from "@/components/CapacitorInit";

export const metadata: Metadata = {
  title: "Solemtrix – Smart Cane Tracking",
  description:
    "Real-time smart cane tracking platform for caregivers and visually impaired users.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <CapacitorInit />
        {children}
      </body>
    </html>
  );
}
