import { Metadata } from 'next'

interface OpenGraphConfig {
  title?: string
  description?: string
  image?: string
  url?: string
}

export function generateOpenGraphMetadata({
  title = "Morpheus Dashboard",
  description = "Enter the Persistent Agentic Compute Delivery Network",
  image = "/opengraph.png",
  url = "https://dashboard.mor.org/"
}: OpenGraphConfig = {}): Metadata {
  const fullUrl = url.startsWith('http') ? url : `https://dashboard.mor.org/${url}`
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: fullUrl,
      siteName: "Morpheus Dashboard",
      type: "website",
      locale: "en_US",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title} - Morpheus Dashboard`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: "@MorpheusAIs",
      creator: "@bowtiedswan",
      images: [
        {
          url: image,
          alt: `${title} - Morpheus Dashboard`,
        },
      ],
    },
  }
}

// Helper function to get absolute URL for images
export function getAbsoluteUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://dashboard.mor.org/'
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

// Validate Open Graph image dimensions
export function validateOGImage(width: number, height: number): boolean {
  // Recommended: 1200x630 (1.91:1 ratio)
  // Minimum: 200x200
  // Maximum: 8MB file size
  const aspectRatio = width / height
  const recommendedRatio = 1200 / 630
  
  return width >= 200 && height >= 200 && Math.abs(aspectRatio - recommendedRatio) < 0.1
} 