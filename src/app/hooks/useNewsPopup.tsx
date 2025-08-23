"use client";

import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'adguardBuddy_lastSeenNewsHash';

export function useNewsPopup() {
  const [isNewsPopupOpen, setIsNewsPopupOpen] = useState(false);
  const [newsContent, setNewsContent] = useState('');
  const [currentNewsHash, setCurrentNewsHash] = useState('');

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) {
          console.error('Failed to fetch news, status:', response.status);
          return;
        }
        const { hash, content } = await response.json();
        const lastSeenHash = localStorage.getItem(LOCAL_STORAGE_KEY);

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
