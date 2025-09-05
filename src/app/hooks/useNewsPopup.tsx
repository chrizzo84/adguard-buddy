"use client";

import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'adguardBuddy_lastSeenNewsHash';

export function useNewsPopup() {
  const [isNewsPopupOpen, setIsNewsPopupOpen] = useState(false);
  const [newsContent, setNewsContent] = useState('');
  const [currentNewsHash, setCurrentNewsHash] = useState('');

  useEffect(() => {
    function handleOpenEvent() {
      setIsNewsPopupOpen(true);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('adguard-buddy:open-news', handleOpenEvent as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('adguard-buddy:open-news', handleOpenEvent as EventListener);
      }
    };
  }, []);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) {
          console.error('Failed to fetch news, status:', response.status);
          return;
        }
        const { hash, content } = await response.json();
        let lastSeenHash;
        try {
          lastSeenHash = localStorage.getItem(LOCAL_STORAGE_KEY);
        } catch {
          // If localStorage read fails, treat as no stored hash
          lastSeenHash = null;
        }

        if (hash !== lastSeenHash) {
          setNewsContent(content);
          setCurrentNewsHash(hash);
          setIsNewsPopupOpen(true);
        }
      } catch {
        console.error('Failed to check for news');
      }
    }

    checkForUpdates();
  }, []);

  function handleClosePopup() {
    setIsNewsPopupOpen(false);
    if (currentNewsHash) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, currentNewsHash);
      } catch {
        /* ignore */
      }
    }
  }

  return { isNewsPopupOpen, newsContent, handleClosePopup } as const;
}
