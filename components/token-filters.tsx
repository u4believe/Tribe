"use client"

import { Sparkles, TrendingUp, Clock, Star, Users, Rewind } from "lucide-react"

export type FilterType = "all" | "rewind2025" | "tribe" | "new" | "older" | "starred"

interface TokenFiltersProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  starredCount?: number
}

export default function TokenFilters({ activeFilter, onFilterChange, starredCount = 0 }: TokenFiltersProps) {
  const filters = [
    {
      id: "all" as FilterType,
      label: "All Tokens",
      icon: Sparkles,
      bgClass: "bg-primary hover:bg-primary/90",
      textClass: "text-primary-foreground",
      activeBorder: "ring-2 ring-primary ring-offset-2",
    },
    {
      id: "rewind2025" as FilterType,
      label: "Re-wind 2025",
      icon: Rewind,
      bgClass: "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700",
      textClass: "text-white",
      activeBorder: "ring-2 ring-cyan-500 ring-offset-2",
    },
    {
      id: "tribe" as FilterType,
      label: "Tribe-Oriented",
      icon: Users,
      bgClass: "bg-gray-300 hover:bg-gray-400",
      textClass: "text-gray-900",
      activeBorder: "ring-2 ring-gray-500 ring-offset-2",
    },
    {
      id: "new" as FilterType,
      label: "New Tokens",
      icon: TrendingUp,
      bgClass: "bg-gradient-to-r from-orange-400 to-green-500 hover:from-orange-500 hover:to-green-600",
      textClass: "text-white",
      activeBorder: "ring-2 ring-orange-500 ring-offset-2",
    },
    {
      id: "older" as FilterType,
      label: "Older Tokens",
      icon: Clock,
      bgClass: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
      textClass: "text-white",
      activeBorder: "ring-2 ring-purple-600 ring-offset-2",
    },
    {
      id: "starred" as FilterType,
      label: "Starred",
      icon: Star,
      count: starredCount,
      bgClass: "bg-yellow-200 hover:bg-yellow-300",
      textClass: "text-yellow-900",
      activeBorder: "ring-2 ring-yellow-500 ring-offset-2",
    },
  ]

  return (
    <div className="flex flex-wrap gap-1.5 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-3 w-full">
      {filters.map((filter) => {
        const Icon = filter.icon
        const isActive = activeFilter === filter.id

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`
              flex items-center justify-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-full md:rounded-lg font-medium text-[10px] md:text-sm whitespace-nowrap transition-all
              ${filter.bgClass} ${filter.textClass}
              ${isActive ? filter.activeBorder : ""}
            `}
          >
            <Icon className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden sm:inline">{filter.label}</span>
            <span className="sm:hidden">{filter.label.split(" ")[0]}</span>
            {filter.count !== undefined && filter.count > 0 && (
              <span className="text-[9px] md:text-xs px-1 md:px-1.5 py-0.5 rounded-full font-semibold bg-black/10">{filter.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
