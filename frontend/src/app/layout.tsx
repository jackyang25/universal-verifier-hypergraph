import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { SimulationStateProvider } from "@/components/providers/SimulationStateProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verified Protocol Hypergraph",
  description: "Simple frontend scaffold for the fullstack app."
};

const bodyFont = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${bodyFont.className} min-h-screen bg-gradient-to-b from-stone-50 via-amber-50/40 to-zinc-100 text-slate-900 antialiased`}
      >
        <SimulationStateProvider>{children}</SimulationStateProvider>
      </body>
    </html>
  );
}
