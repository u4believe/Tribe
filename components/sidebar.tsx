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

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarContext.Provider value={{ isCollapsed: true, setIsCollapsed: () => {} }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar() {
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

  const mobileNavItems = navItems.slice(0, 5)

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-16 bg-card border-r border-border z-40 hidden md:flex flex-col">
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

      <nav className="fixed bottom-0 left-0 right-0 z-[70] md:hidden bg-card/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around px-1 py-1.5 pb-[env(safe-area-inset-bottom,0px)]">
          {mobileNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path

            return item.external ? (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-muted-foreground active:bg-primary/10"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] leading-tight">{item.label}</span>
              </a>
            ) : (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:bg-primary/10",
                )}
                type="button"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] leading-tight">{item.label.split(" ")[0]}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default Sidebar
