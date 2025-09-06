import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock localStorage and document.body
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const bodyMock = document.createElement('body');

// Apply mocks
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(document, 'body', {
  value: bodyMock,
  writable: true,
});

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bodyMock.className = '';
  });

  describe('ThemeProvider', () => {
    it('applies theme class to body and saves to localStorage', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(bodyMock.className).toBe('theme-green');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('adguard-buddy-theme', 'green');
      });
    });

    it('loads theme from localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('purple');

      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('adguard-buddy-theme');
        expect(bodyMock.className).toBe('theme-purple');
      });
    });

    it('ignores invalid theme from localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-theme');

      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(bodyMock.className).toBe('theme-green');
      });
    });
  });

  describe('useTheme hook', () => {
    it('throws error when used outside ThemeProvider', () => {
      const TestComponent = () => {
        useTheme();
        return <div>Test</div>;
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});
