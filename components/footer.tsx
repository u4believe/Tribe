import { Twitter } from "lucide-react"

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card mt-16">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">© 2025 Tribe Meme</div>

          <a
            href="https://x.com/Tribememe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Twitter className="w-5 h-5" />
            <span className="text-sm">Follow us on Twitter</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
