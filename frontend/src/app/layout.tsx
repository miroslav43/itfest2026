import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solemtrix – Urmărire baston inteligent",
  description:
    "Aplicație pentru îngrijitori – urmărire în timp real a bastonului inteligent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="h-full">{children}</body>
    </html>
  );
}
