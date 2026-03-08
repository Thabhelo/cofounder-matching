import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { WebVitals } from "@/components/WebVitals"
import "./globals.css"
import Script from "next/script"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#18181b",
}

export const metadata: Metadata = {
  title: "Co-Founder Matching Platform",
  description: "Find your perfect co-founder and access entrepreneurial resources",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoFounder Match",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Co-Founder Matching Platform",
    description: "Find your perfect co-founder and access entrepreneurial resources",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: "#18181b",
          colorBackground: "#ffffff",
          colorInputBackground: "#ffffff",
          colorInputText: "#18181b",
          borderRadius: "0.5rem",
        },
        elements: {
          formButtonPrimary:
            "bg-zinc-900 hover:bg-zinc-800 text-sm normal-case font-medium",
          card: "shadow-sm",
          headerTitle: "text-zinc-900 font-semibold",
          headerSubtitle: "text-zinc-600",
          socialButtonsBlockButton:
            "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
          formFieldLabel: "text-zinc-700 font-medium",
          formFieldInput:
            "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900",
          footerActionLink: "text-zinc-900 hover:text-zinc-700",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased bg-white text-zinc-900`}>
          <WebVitals />
          {children}
          <Script
            id="register-sw"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                }
              `,
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
