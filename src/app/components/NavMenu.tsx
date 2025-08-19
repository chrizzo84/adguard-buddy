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

export default function NavMenu() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-x-8 mb-10 justify-center border-b border-white/10 pb-4">
      {menu.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`text-lg font-medium transition-colors relative
            ${
              pathname === item.href
                ? 'text-neon'
                : 'text-gray-400 hover:text-white'
            }`}
        >
          {item.name}
          {pathname === item.href && (
            <span className="absolute -bottom-[17px] left-0 right-0 h-1 bg-[var(--primary)] shadow-neon rounded-full" />
          )}
        </Link>
      ))}
    </nav>
  );
}
