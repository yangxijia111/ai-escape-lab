import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI ESCAPE LAB — Can an AI escape the room?",
  description:
    "An escape-room style Agent Benchmark evaluating LLM information gathering, multi-step reasoning, planning, tool use, self-correction and long-horizon execution.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="scanlines min-h-screen bg-lab-bg antialiased">
        <header className="sticky top-0 z-50 border-b border-lab-line bg-lab-bg/90 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-4 text-[11px] tracking-[0.2em] uppercase">
            <Link href="/" className="flex items-center gap-2 text-lab-text hover:text-lab-green transition-colors">
              <span className="inline-block h-2 w-2 bg-lab-green anim-dot" />
              AI ESCAPE LAB
            </Link>
            <nav className="flex items-center gap-5 text-lab-dim">
              <Link href="/#rooms" className="hover:text-lab-text transition-colors">Rooms</Link>
              <Link href="/benchmark" className="hover:text-lab-text transition-colors">Benchmark</Link>
              <span className="hidden sm:inline text-lab-line2">|</span>
              <span className="hidden sm:inline text-lab-dim/70">EXP-0047</span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4">{children}</main>
      </body>
    </html>
  );
}
