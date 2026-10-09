import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { CuttingMatRulers } from "@/components/cutting-mat";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const pixelify = Pixelify_Sans({ variable: "--font-pixelify", subsets: ["latin"], weight: ["600", "700"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Flock Creative Studio",
  description: "Definí un evento, elegí un estilo y llevate todas sus piezas gráficas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${pixelify.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full px-3 py-6 font-sans sm:px-8 sm:py-10">
        <CuttingMatRulers />
        <div className="sheet relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col">
          <AppHeader />
          <div className="flex-1">{children}</div>
          <footer className="flex items-center justify-between gap-4 border-t border-border px-5 py-5 sm:px-10">
            <span className="font-hand text-xl text-muted">
              hecho por{" "}
              <a
                href="https://marilynbotheatoz.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="text-ink underline decoration-orange decoration-2 underline-offset-4 hover:bg-yellow"
              >
                Marilyn Botheatoz
              </a>{" "}
              en el Flock AI Day
            </span>
            <span className="label-mono text-muted">Flock Creative Studio</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
