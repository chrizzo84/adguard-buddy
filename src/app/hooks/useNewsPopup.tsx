"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

const LOCAL_STORAGE_KEY = 'adguardBuddy_lastSeenNewsHash';

export function useNewsPopup() {
  const [isNewsPopupOpen, setIsNewsPopupOpen] = useState(false);
  const [newsContent, setNewsContent] = useState('');
  const [currentNewsHash, setCurrentNewsHash] = useState('');
  const isFetchingRef = useRef(false);

  const fetchNews = useCallback(async () => {
    if (isFetchingRef.current) return null;
    isFetchingRef.current = true;
    try {
      const response = await fetch('/api/news');
      if (!response.ok) {
        console.error('Failed to fetch news, status:', response.status);
        return null;
      }
      const { hash, content } = await response.json();
      setNewsContent(content);
      setCurrentNewsHash(hash);
      return { hash, content };
    } catch (err) {
      console.error('Failed to fetch news', err);
      return null;
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    function handleOpenEvent() {
      (async () => {
        // ensure we have content before opening so popup isn't empty
        await fetchNews();
        setIsNewsPopupOpen(true);
      })();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('adguard-buddy:open-news', handleOpenEvent as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('adguard-buddy:open-news', handleOpenEvent as EventListener);
      }
    };
  }, [fetchNews]);

  useEffect(() => {
    // On mount, fetch once to check for automatic display
    (async () => {
      const result = await fetchNews();
      try {
        const lastSeenHash = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (result && result.hash !== lastSeenHash) {
          setIsNewsPopupOpen(true);
        }
      } catch {
        // ignore localStorage errors
      }
    })();
  }, [fetchNews]);

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
