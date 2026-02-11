import type { Metadata } from "next";
import { SimulationStateProvider } from "@/components/providers/SimulationStateProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verified Protocol Hypergraph",
  description: "Simple frontend scaffold for the fullstack app."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-100 text-slate-900">
        <SimulationStateProvider>{children}</SimulationStateProvider>
      </body>
    </html>
  );
}
