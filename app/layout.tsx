import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/sidebar"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "TRIBE - Meme Token Launchpad",
  description: "Launch and trade meme tokens on a bonding curve. Create your token with TRIBE.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className="font-sans antialiased overflow-x-hidden">
        <SidebarProvider>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 max-w-md rounded-lg border border-yellow-500/20 bg-gradient-to-br from-yellow-950/90 to-orange-950/90 p-8 shadow-2xl backdrop-blur-md">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-yellow-500/20 p-3">
                  <svg className="h-8 w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="mb-3 text-center text-2xl font-bold text-yellow-400">Trading Temporarily Paused</h2>
              <p className="text-center text-base leading-relaxed text-yellow-100/90">
                Trading is currently paused while we complete a scheduled protocol update. All user funds remain safe.
                Trading will resume shortly.
              </p>
            </div>
          </div>
          <div className="blur-sm">{children}</div>
        </SidebarProvider>
      </body>
    </html>
  )
}
