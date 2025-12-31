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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#181A20] border border-[#2A2D35] max-w-3xl w-full mx-4 rounded-xl shadow-2xl overflow-hidden max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-[#2A2D35] relative">
          <div className="text-sm text-gray-600 dark:text-gray-300">What&apos;s New</div>
          <div className="flex gap-2 items-center">
            <button
              className={`px-3 py-1 rounded text-sm transition-colors ${mode === 'raw' ? 'bg-[#2A2D35] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2A2D35]'}`}
              onClick={() => setMode('raw')}
            >
              Raw
            </button>
            <button
              className={`px-3 py-1 rounded text-sm transition-colors ${mode === 'preview' ? 'bg-[#2A2D35] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2A2D35]'}`}
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
