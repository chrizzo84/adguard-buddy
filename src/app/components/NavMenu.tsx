"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Query Log", href: "/query-log" },
  { name: "Statistics", href: "/statistics" },
  { name: "Sync Status", href: "/sync-status" },
  { name: "Settings", href: "/settings" },
];

/**
 * @deprecated Use NavBar component instead. This is kept for backwards compatibility
 * with existing pages during migration.
 */
export default function NavMenu() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-x-2 mb-8 justify-center flex-wrap">
      {menu.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${pathname === item.href
              ? "text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
}
