"use client";

import React, { useState } from 'react';
import { parse as markedParse } from 'marked';
import DOMPurify from 'dompurify';

export default function NewsPopup({
  isOpen,
  onClose,
  content,
}: {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}) {
  const [mode, setMode] = useState<'raw' | 'preview'>('preview');

  if (!isOpen) return null;

  const rawHtml = markedParse(content || '');
  const safeHtml = DOMPurify.sanitize(rawHtml);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#0b1220] max-w-3xl w-full mx-4 rounded-xl shadow-xl overflow-hidden max-h-[80vh]">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/5 relative">
          <div className="text-sm text-gray-600 dark:text-gray-300">What&apos;s New</div>
          <div className="flex gap-2 items-center">
            <button
              className={`px-3 py-1 rounded text-sm ${mode === 'raw' ? 'bg-gray-200 dark:bg-white/5' : 'hover:bg-gray-100 dark:hover:bg-white/3'}`}
              onClick={() => setMode('raw')}
            >
              Raw
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${mode === 'preview' ? 'bg-gray-200 dark:bg-white/5' : 'hover:bg-gray-100 dark:hover:bg-white/3'}`}
              onClick={() => setMode('preview')}
            >
              Preview
            </button>
            {/* Top-right close button for clarity */}
            <button
              onClick={onClose}
              aria-label="Close news"
              className="ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl leading-none"
              title="Close"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[72vh]">
          {mode === 'raw' ? (
            <pre data-testid="news-raw-content" className="p-6 font-mono text-sm whitespace-pre-wrap break-words">
              {content}
            </pre>
          ) : (
            <div data-testid="news-preview-content" className="p-6 news-preview" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          )}
        </div>

  {/* footer removed - single top-right close button is used */}
      </div>
    </div>
  );
}
