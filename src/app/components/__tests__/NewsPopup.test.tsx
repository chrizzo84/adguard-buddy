import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NewsPopup from '../NewsPopup';

// Mock marked and DOMPurify
jest.mock('marked', () => ({
  parse: jest.fn((content: string) => `<p>${content}</p>`),
}));

jest.mock('dompurify', () => ({
  sanitize: jest.fn((html: string) => html),
}));

describe('NewsPopup', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    content: 'Test news content',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<NewsPopup {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("What's New")).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<NewsPopup {...defaultProps} />);

    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText('Test news content')).toBeInTheDocument();
  });

  it('should display content in preview mode by default', () => {
    render(<NewsPopup {...defaultProps} />);

    // Should show preview mode button as active (no additional class for inactive)
    const previewButton = screen.getByText('Preview');
    const rawButton = screen.getByText('Raw');

    expect(previewButton).toHaveClass('bg-[#2A2D35]', 'text-white');
    expect(rawButton).not.toHaveClass('bg-[#2A2D35]');
  });

  it('should switch to raw mode when Raw button is clicked', () => {
    render(<NewsPopup {...defaultProps} />);

    const rawButton = screen.getByText('Raw');
    fireEvent.click(rawButton);

    // Raw button should now be active
    expect(rawButton).toHaveClass('bg-[#2A2D35]', 'text-white');
    expect(screen.getByText('Preview')).not.toHaveClass('bg-[#2A2D35]');

    // Should display content as raw text
    expect(screen.getByText('Test news content')).toBeInTheDocument();
  });

  it('should switch back to preview mode when Preview button is clicked', () => {
    render(<NewsPopup {...defaultProps} />);

    // Start in raw mode
    const rawButton = screen.getByText('Raw');
    fireEvent.click(rawButton);

    // Switch back to preview
    const previewButton = screen.getByText('Preview');
    fireEvent.click(previewButton);

    expect(previewButton).toHaveClass('bg-[#2A2D35]', 'text-white');
    expect(rawButton).not.toHaveClass('bg-[#2A2D35]');
  });

  it('should call onClose when close button is clicked', () => {
    render(<NewsPopup {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close news');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should render raw content in pre tag when in raw mode', () => {
    render(<NewsPopup {...defaultProps} />);

    fireEvent.click(screen.getByText('Raw'));

    const preElement = screen.getByTestId('news-raw-content');
    expect(preElement.tagName).toBe('PRE');
    expect(preElement).toHaveClass('font-mono', 'text-sm', 'whitespace-pre-wrap', 'break-words');
  });

  it('should render preview content with dangerouslySetInnerHTML', () => {
    const mockSanitize = require('dompurify').sanitize;
    const mockParse = require('marked').parse;

    mockParse.mockReturnValue('<h1>Test HTML</h1>');
    mockSanitize.mockReturnValue('<h1>Sanitized HTML</h1>');

    render(<NewsPopup {...defaultProps} />);

    // Should be in preview mode by default
    const previewDiv = screen.getByTestId('news-preview-content');
    expect(previewDiv).toHaveClass('news-preview');

    expect(mockParse).toHaveBeenCalledWith('Test news content');
    expect(mockSanitize).toHaveBeenCalledWith('<h1>Test HTML</h1>');
  });

  it('should handle empty content', () => {
    render(<NewsPopup {...defaultProps} content="" />);

    expect(screen.getByText("What's New")).toBeInTheDocument();

    // Should still render in both modes
    fireEvent.click(screen.getByText('Raw'));
    expect(screen.getByTestId('news-raw-content')).toBeInTheDocument();
  });

  it('should handle markdown content', () => {
    const markdownContent = '# Header\n\nThis is **bold** text.';
    const mockParse = require('marked').parse;
    const mockSanitize = require('dompurify').sanitize;

    mockParse.mockReturnValue('<h1>Header</h1><p>This is <strong>bold</strong> text.</p>');
    mockSanitize.mockReturnValue('<h1>Header</h1><p>This is <strong>bold</strong> text.</p>');

    render(<NewsPopup {...defaultProps} content={markdownContent} />);

    expect(mockParse).toHaveBeenCalledWith(markdownContent);
    expect(mockSanitize).toHaveBeenCalledWith('<h1>Header</h1><p>This is <strong>bold</strong> text.</p>');
  });

  it('should have proper accessibility attributes', () => {
    render(<NewsPopup {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close news');
    expect(closeButton).toHaveAttribute('aria-label', 'Close news');
    expect(closeButton).toHaveAttribute('title', 'Close');
  });

  it('should have proper CSS classes for styling', () => {
    render(<NewsPopup {...defaultProps} />);

    // Check main container classes
    const mainContainer = screen.getByTestId('news-preview-content').closest('.fixed');
    expect(mainContainer).toHaveClass('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/70', 'backdrop-blur-sm');

    // Check modal classes
    const modal = mainContainer?.querySelector('.bg-\\[\\#181A20\\]');
    expect(modal).toHaveClass('bg-[#181A20]', 'border', 'border-[#2A2D35]', 'max-w-3xl', 'w-full', 'mx-4', 'rounded-xl', 'shadow-2xl', 'overflow-hidden', 'max-h-[80vh]');
  });

  it('should handle mode switching multiple times', () => {
    render(<NewsPopup {...defaultProps} />);

    const rawButton = screen.getByText('Raw');
    const previewButton = screen.getByText('Preview');

    // Switch to raw
    fireEvent.click(rawButton);
    expect(rawButton).toHaveClass('bg-[#2A2D35]', 'text-white');

    // Switch to preview
    fireEvent.click(previewButton);
    expect(previewButton).toHaveClass('bg-[#2A2D35]', 'text-white');

    // Switch to raw again
    fireEvent.click(rawButton);
    expect(rawButton).toHaveClass('bg-[#2A2D35]', 'text-white');
  });

  it('should call onClose only when close button is clicked', () => {
    render(<NewsPopup {...defaultProps} />);

    // Click on other elements should not trigger onClose
    fireEvent.click(screen.getByText('Raw'));
    fireEvent.click(screen.getByText('Preview'));

    expect(defaultProps.onClose).not.toHaveBeenCalled();

    // Only close button should trigger onClose
    fireEvent.click(screen.getByLabelText('Close news'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
