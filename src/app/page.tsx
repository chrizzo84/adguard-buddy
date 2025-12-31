"use client";
import Link from "next/link";
import { LayoutDashboard, FileSearch, BarChart3, RefreshCw, Settings, ArrowRight } from "lucide-react";

const quickLinks = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Monitor all your AdGuard Home instances"
  },
  {
    name: "Query Log",
    href: "/query-log",
    icon: FileSearch,
    description: "View and search DNS query history"
  },
  {
    name: "Statistics",
    href: "/statistics",
    icon: BarChart3,
    description: "Analyze traffic and blocking stats"
  },
  {
    name: "Sync Status",
    href: "/sync-status",
    icon: RefreshCw,
    description: "Check synchronization between servers"
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Configure connections and preferences"
  },
];

export default function Home() {
  return (
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
          Welcome to <span className="text-[var(--primary)]">AdGuard Buddy</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          A powerful tool to manage and synchronize your AdGuard Home instances.
          Monitor, control, and keep your network protection in sync.
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="adguard-card group hover:border-[var(--primary)]/50 transition-all duration-300 hover:shadow-[0_0_30px_var(--primary-light)]"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] group-hover:bg-[var(--primary)]/20 transition-colors">
                <link.icon className="w-6 h-6" />
              </div>
              <div className="flex-grow">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  {link.name}
                  <ArrowRight className="w-4 h-4 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                </h3>
                <p className="text-gray-500 text-sm mt-1">{link.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Getting Started */}
      <div className="mt-12 adguard-card">
        <h2 className="text-xl font-bold text-white mb-4">Getting Started</h2>
        <ol className="space-y-3 text-gray-400">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-sm font-bold flex items-center justify-center">1</span>
            <span>Go to <Link href="/settings" className="text-[var(--primary)] hover:underline">Settings</Link> and add your AdGuard Home connections</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-sm font-bold flex items-center justify-center">2</span>
            <span>Set a master server for synchronization</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-sm font-bold flex items-center justify-center">3</span>
            <span>View the <Link href="/dashboard" className="text-[var(--primary)] hover:underline">Dashboard</Link> to monitor all instances</span>
          </li>
        </ol>
      </div>
    </main>
  );
}
