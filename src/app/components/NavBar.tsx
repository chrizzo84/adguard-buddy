"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Bell } from "lucide-react";

const menu = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Query Log", href: "/query-log" },
    { name: "Statistics", href: "/statistics" },
    { name: "Sync Status", href: "/sync-status" },
    { name: "Settings", href: "/settings" },
];

export function NavBar() {
    const pathname = usePathname();

    return (
        <nav className="sticky top-0 z-50 bg-[#0F1115]/80 backdrop-blur-md border-b border-[#2A2D35]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-[var(--primary)]" />
                        <span className="text-xl font-bold tracking-tight text-white">
                            AdGuard<span className="text-[var(--primary)]">Buddy</span>
                        </span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex space-x-1">
                        {menu.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${isActive
                                            ? "text-[var(--primary)] bg-[var(--primary)]/10 border-b-2 border-[var(--primary)]"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-4">
                        <button className="p-2 rounded-full text-gray-500 hover:bg-white/5 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <div className="h-8 w-8 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] font-bold text-xs border border-[var(--primary)]/30">
                            AB
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden pb-3 flex overflow-x-auto gap-1 scrollbar-hide">
                    {menu.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
                  ${isActive
                                        ? "text-[var(--primary)] bg-[var(--primary)]/10"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
