import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

// Fraunces — warm editorial serif, display only. DM Sans — razor-legible body.
// Loaded via next/font so they self-host with no layout shift. See DESIGN.md.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YoBite — Eat out. Skip the menu math.",
  description:
    "Scan any restaurant menu, tell us your goal, and get one confident order. A ranker, not a calorie counter. Built for the local place where you're actually confused.",
  applicationName: "YoBite",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "YoBite" },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: {
    title: "YoBite — Eat out. Skip the menu math.",
    description: "Scan a menu, pick your goal, get one confident order.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EF" },
    { media: "(prefers-color-scheme: dark)", color: "#181410" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
