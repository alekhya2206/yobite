import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

// Bricolage Grotesque — characterful display/brand. DM Sans — razor-legible body.
// Loaded via next/font so they self-host with no layout shift. See DESIGN.md.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
  title: "YoBite — Order this.",
  description:
    "Scan a local restaurant menu, say what you're in the mood for, and get one confident order with honest reasons. A ranker, not a calorie counter.",
  applicationName: "YoBite",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "YoBite" },
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "YoBite — Order this.",
    description: "Scan a menu, say your mood, get one confident order.",
    type: "website",
    images: [{ url: "/logo.png", width: 1254, height: 1254, alt: "YoBite" }],
  },
};

export const viewport: Viewport = {
  // Light-only to match the approved mockups (no dark variant ships in v1).
  themeColor: "#FFF1E6",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
