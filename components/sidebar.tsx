"use client"

import type React from "react"

import { createContext, useContext } from "react"
import { Home, Trophy, BookOpen, HelpCircle, ArrowLeftRight, Vote } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarContext.Provider value={{ isCollapsed: true, setIsCollapsed: () => {} }}>
      {children}
    </SidebarContext.Provider>
  )
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    { icon: Home, label: "Home", path: "/", external: false },
    { icon: ArrowLeftRight, label: "DEX", path: "https://trustswap.intuition.box/home", external: true },
    { icon: Vote, label: "Vote", path: "/vote", external: false },
    { icon: Trophy, label: "Leaderboard", path: "/leaderboard", external: false },
    { icon: BookOpen, label: "Docs", path: "https://tribe-documentation.vercel.app/", external: true },
    { icon: HelpCircle, label: "FAQ", path: "/faq", external: false },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 bg-card border-r border-border z-40 flex flex-col">
      {/* Logo section - hidden in icon-only mode */}
      <div className="h-[120px] flex items-center justify-center border-b border-border">
        <Image src="/tribe-logo.png" alt="TRIBE" width={32} height={32} className="object-contain" />
      </div>

      <nav className="flex-1 pt-4 pb-4">
        <ul className="space-y-2 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path

            return (
              <li key={item.path}>
                {item.external ? (
                  <a
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full flex items-center justify-center p-3 rounded-lg transition-all duration-300 relative group",
                      "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />

                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                  </a>
                ) : (
                  <button
                    onClick={() => router.push(item.path)}
                    className={cn(
                      "w-full flex items-center justify-center p-3 rounded-lg transition-all duration-300 relative group",
                      isActive
                        ? "bg-primary text-white"
                        : "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                    title={item.label}
                    type="button"
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />

                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
