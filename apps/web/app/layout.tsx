import type { Metadata } from "next";
import { Commissioner, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "../components/site-header";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "opsz", "WONK"],
});

const sans = Commissioner({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "PromptMarket",
    template: "%s · PromptMarket",
  },
  description: "Tested agent recipes for AI coding agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div className="atmosphere" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="shell">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
