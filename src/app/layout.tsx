"use client"; // This is needed for useEffect

import './globals.css'
import { Inter } from 'next/font/google'
import { AppProviders } from './components/AppProviders';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    fetch('/api/start-autosync');
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}