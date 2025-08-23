"use client";

import { Github } from "lucide-react";
import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  function openNews() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('adguard-buddy:open-news'));
    }
  }

  return (
    <footer className="mt-10 border-t border-white/10 px-6 py-4 text-[11px] text-white/60 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
      <span className="whitespace-nowrap">© {year} chrizzo84</span>
      <span className="hidden sm:inline text-white/30">•</span>
      <Link
        href="https://github.com/chrizzo84"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-white transition-colors"
        aria-label="GitHub Profile chrizzo84"
      >
        <Github className="h-4 w-4" aria-hidden="true" />
        <span>Profile</span>
      </Link>
      <span className="hidden sm:inline text-white/30">•</span>
      <Link
        href="https://github.com/chrizzo84/adguard-buddy"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-white transition-colors"
        aria-label="Repository adguard-buddy"
      >
        <Github className="h-4 w-4" aria-hidden="true" />
        <span>Repo</span>
      </Link>
      <span className="hidden sm:inline text-white/30">•</span>
      <button
        onClick={openNews}
        className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors"
        aria-label="Open What's New"
      >
        <span className="underline text-[11px]">What&apos;s New</span>
      </button>
    </footer>
  );
}
