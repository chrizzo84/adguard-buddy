import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProviders } from '../AppProviders';

// Mock the useNewsPopup hook
jest.mock('../../hooks/useNewsPopup', () => ({
  useNewsPopup: jest.fn(),
}));

// Mock the NewsPopup component
jest.mock('../NewsPopup', () => {
  return function MockNewsPopup({ isOpen, onClose, content }: { isOpen: boolean; onClose: () => void; content: string }) {
    return isOpen ? (
      <div data-testid="news-popup" data-content={content} data-onclose={onClose.toString()}>
        News Popup Mock
      </div>
    ) : null;
  };
});

// Mock the ThemeProvider
jest.mock('../../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">
      {children}
    </div>
  ),
}));

const mockUseNewsPopup = require('../../hooks/useNewsPopup').useNewsPopup;

describe('AppProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children wrapped in ThemeProvider', () => {
    mockUseNewsPopup.mockReturnValue({
      isNewsPopupOpen: false,
      newsContent: '',
      handleClosePopup: jest.fn(),
    });

    const TestChild = () => <div data-testid="test-child">Test Child</div>;

    render(
      <AppProviders>
        <TestChild />
      </AppProviders>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should render NewsPopup when isNewsPopupOpen is true', () => {
    const mockHandleClose = jest.fn();
    const testContent = 'Test news content';

    mockUseNewsPopup.mockReturnValue({
      isNewsPopupOpen: true,
      newsContent: testContent,
      handleClosePopup: mockHandleClose,
    });

    const TestChild = () => <div>Test Child</div>;

    render(
      <AppProviders>
        <TestChild />
      </AppProviders>
    );

    const newsPopup = screen.getByTestId('news-popup');
    expect(newsPopup).toBeInTheDocument();
    expect(newsPopup).toHaveAttribute('data-content', testContent);
  });

  it('should not render NewsPopup when isNewsPopupOpen is false', () => {
    mockUseNewsPopup.mockReturnValue({
      isNewsPopupOpen: false,
      newsContent: 'Some content',
      handleClosePopup: jest.fn(),
    });

    const TestChild = () => <div>Test Child</div>;

    render(
      <AppProviders>
        <TestChild />
      </AppProviders>
    );

    expect(screen.queryByTestId('news-popup')).not.toBeInTheDocument();
  });

  it('should pass correct props to NewsPopup', () => {
    const mockHandleClose = jest.fn();
    const testContent = 'News content here';

    mockUseNewsPopup.mockReturnValue({
      isNewsPopupOpen: true,
      newsContent: testContent,
      handleClosePopup: mockHandleClose,
    });

    const TestChild = () => <div>Test Child</div>;

    render(
      <AppProviders>
        <TestChild />
      </AppProviders>
    );

    const newsPopup = screen.getByTestId('news-popup');
    expect(newsPopup).toHaveAttribute('data-content', testContent);
    expect(newsPopup).toHaveAttribute('data-onclose', mockHandleClose.toString());
  });

  it('should handle empty news content', () => {
    mockUseNewsPopup.mockReturnValue({
      isNewsPopupOpen: true,
      newsContent: '',
      handleClosePopup: jest.fn(),
    });

    const TestChild = () => <div>Test Child</div>;

    render(
      <AppProviders>
        <TestChild />
      </AppProviders>
    );

    const newsPopup = screen.getByTestId('news-popup');
    expect(newsPopup).toHaveAttribute('data-content', '');
  });

  it('should render multiple children correctly', () => {
    mockUseNewsPopup.mockReturnValue({
      isNewsPopupOpen: false,
      newsContent: '',
      handleClosePopup: jest.fn(),
    });

    const TestChild1 = () => <div data-testid="child-1">Child 1</div>;
    const TestChild2 = () => <div data-testid="child-2">Child 2</div>;

    render(
      <AppProviders>
        <TestChild1 />
        <TestChild2 />
      </AppProviders>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });
});
