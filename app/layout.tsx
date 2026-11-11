import type { Metadata } from "next";
import { Barlow, IBM_Plex_Mono, Saira_Condensed } from "next/font/google";
import "./globals.css";

/**
 * Console signage, a technical body face, and a clinical readout — the voice
 * of a management HUD rather than a document.
 */
const display = Saira_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

/**
 * WHERE THIS IS SERVED FROM
 *
 * `metadataBase` turns the relative asset paths Next generates — the tab icon,
 * the link-preview card — into the absolute URLs that Open Graph and Twitter
 * require. Without it Next guesses `http://localhost:3000` and says so at
 * build time, which would put a dead localhost URL in every shared link.
 *
 * Resolved from the environment rather than hardcoded, in falling order of
 * how much we trust it:
 *
 *   NEXT_PUBLIC_SITE_URL           set deliberately, so it wins outright
 *   VERCEL_PROJECT_PRODUCTION_URL  the stable production domain, if deployed there
 *   VERCEL_URL                     this specific deployment, for previews
 *   localhost:3500                 development, on the port `npm run dev` uses
 *
 * No production domain is invented here. Until one is set the value is
 * honestly local, which is correct for a game that has not been deployed.
 */
function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  /* Vercel supplies these without a protocol. */
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);

  return new URL("http://localhost:3500");
}

const TITLE = "Earn Your Skyline";
const DESCRIPTION =
  "Seven careers, one rule: the work arrives whether or not you can afford to do it. Build a practice, a kitchen, a chambers, a startup, a campaign, a studio or a workshop from debt to skyline.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  /* One page, so the canonical is the root. */
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    /*
     * No `images` here on purpose. `app/opengraph-image.png` is a Next file
     * convention: the framework finds it, reads its real dimensions and emits
     * the tags itself. Listing it again would produce a second, duplicate
     * og:image that could drift from the file.
     */
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
