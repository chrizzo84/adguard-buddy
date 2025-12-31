import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./components/AppProviders";
import { SiteFooter } from "./components/SiteFooter";
import { NavBar } from "./components/NavBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdGuard Buddy",
  description: "A simple tool to synchronize AdGuard Home instances.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0F1115] text-gray-300 min-h-screen flex flex-col`}
      >
        <AppProviders>
          <NavBar />
          <main className="flex-grow">{children}</main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
