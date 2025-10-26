import "./globals.css"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { GoogleAnalytics } from '@next/third-parties/google'
import { Analytics } from "@vercel/analytics/next"
import { RootLayoutContent } from "@/components/root-layout"
import { headers } from "next/headers"
import { cookieToInitialState } from "wagmi"
import { config } from "@/config"
import { cn } from "@/lib/utils"
import { Providers } from './providers'
import { FeaturebaseWidget } from '@/components/featurebase-widget'
import * as Sentry from '@sentry/nextjs'

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export function generateMetadata(): Metadata {
  return {
    title: "Morpheus Dashboard",
    description: "Enter the Persistent Agentic Compute Delivery Network",
    icons: {
      icon: "/logo-black.png",
      shortcut: "/logo-black.png",
      apple: "/logo-black.png",
    },
    openGraph: {
      title: "Morpheus Dashboard",
      description: "Enter the Persistent Agentic Compute Delivery Network",
      url: "https://builders.mor.org/",
      siteName: "Morpheus Dashboard",
      type: "website",
      locale: "en_US",
      images: [
        {
          url: "/opengraph.png",
          width: 1200,
          height: 630,
          alt: "Morpheus Dashboard - Enter the Persistent Agentic Compute Delivery Network",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Morpheus Dashboard",
      description: "Enter the Persistent Agentic Compute Delivery Network",
      site: "@MorpheusAIs",
      creator: "@bowtiedswan",
      images: [
        {
          url: "/opengraph.png",
          alt: "Morpheus Dashboard - Enter the Persistent Agentic Compute Delivery Network",
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers()
  const initialState = cookieToInitialState(config, headersList.get("cookie"))

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", geistSans.variable, geistMono.variable)}>
        <GoogleAnalytics gaId='G-RTZPQB9Y3J' />
        <Analytics />
        <Providers initialState={initialState}>
          <RootLayoutContent>{children}</RootLayoutContent>
          <FeaturebaseWidget />
        </Providers>
      </body>
    </html>
  );
}
