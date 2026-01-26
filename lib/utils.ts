import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    const billions = num / 1_000_000_000
    // If it's a clean billion (like 1B), show without decimal
    if (billions === Math.floor(billions)) {
      return `${Math.floor(billions)}B`
    }
    return `${billions.toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    const millions = num / 1_000_000
    if (millions === Math.floor(millions)) {
      return `${Math.floor(millions)}M`
    }
    return `${millions.toFixed(1)}M`
  }
  if (num >= 1_000) {
    const thousands = num / 1_000
    if (thousands === Math.floor(thousands)) {
      return `${Math.floor(thousands)}K`
    }
    return `${thousands.toFixed(1)}K`
  }
  return num.toString()
}
