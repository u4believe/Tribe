"use client"

import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import Footer from "@/components/footer"
import { ArrowLeftRight, TrendingUp, Droplet } from "lucide-react"

export default function DexPage() {
  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 ml-16">
        <Header onCreateClick={() => {}} />
        <div className="container mx-auto px-4 py-8 pt-28">
          <div className="text-center space-y-4 mb-12">
            <div className="flex items-center justify-center gap-3">
              <ArrowLeftRight className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">DEX</h1>
            </div>
            <p className="text-muted-foreground text-lg">Decentralized exchange functionality coming soon</p>
          </div>

          <div className="grid gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start gap-4">
                <ArrowLeftRight className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Token Swaps</h2>
                  <p className="text-muted-foreground">
                    Trade TRIBE tokens directly with other users without intermediaries.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start gap-4">
                <Droplet className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Liquidity Pools</h2>
                  <p className="text-muted-foreground">Provide liquidity and earn rewards from trading fees.</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start gap-4">
                <TrendingUp className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Analytics</h2>
                  <p className="text-muted-foreground">View detailed trading statistics and market insights.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  )
}
