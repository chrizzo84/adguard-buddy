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
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/5">
          <div className="text-sm text-gray-600 dark:text-gray-300">What&apos;s New</div>
          <div className="flex gap-2">
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
          </div>
        </div>

        <div className="overflow-auto max-h-[72vh]">
          {mode === 'raw' ? (
            <pre className="p-6 font-mono text-sm whitespace-pre-wrap break-words">
              {content}
            </pre>
          ) : (
            <div className="p-6 news-preview" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-white/5 flex justify-end">
          <button
            className="px-4 py-2 rounded bg-[var(--primary)] text-black font-medium"
            onClick={onClose}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
