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
    <footer className="border-t border-[#2A2D35] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 gap-4">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <span>© {year} chrizzo84</span>
            <Link
              href="https://github.com/chrizzo84"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
              aria-label="GitHub Profile chrizzo84"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span>Profile</span>
            </Link>
            <Link
              href="https://github.com/chrizzo84/adguard-buddy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
              aria-label="Repository adguard-buddy"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span>Repo</span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <span className="font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            <button
              onClick={openNews}
              className="hover:text-[var(--primary)] transition-colors underline"
              aria-label="Open What's New"
            >
              What&apos;s New
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
