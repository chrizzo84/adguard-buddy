"use client";

import { ThemeProvider } from '../contexts/ThemeContext';
import { ReactNode } from 'react';
import { useNewsPopup } from '../hooks/useNewsPopup';
import NewsPopup from './NewsPopup';

export function AppProviders({ children }: { children: ReactNode }) {
  const { isNewsPopupOpen, newsContent, handleClosePopup } = useNewsPopup();

  return (
    <ThemeProvider>
      {children}
      <NewsPopup isOpen={isNewsPopupOpen} onClose={handleClosePopup} content={newsContent} />
    </ThemeProvider>
  );
}
