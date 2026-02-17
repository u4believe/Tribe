import { Twitter } from "lucide-react"

export default function Footer() {
  return (
    <footer className="hidden md:block fixed bottom-0 left-16 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">© 2025 Tribe Meme</div>
          <a
            href="https://x.com/Tribememe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
          >
            <Twitter className="w-3.5 h-3.5" />
            <span className="text-xs">Follow us on Twitter</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
