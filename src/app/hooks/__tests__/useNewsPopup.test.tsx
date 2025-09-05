import { renderHook, act, waitFor } from '@testing-library/react';
import { useNewsPopup } from '../useNewsPopup';

// Mock fetch
const fetchMock = jest.fn();
global.fetch = fetchMock;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.addEventListener and removeEventListener
const addEventListenerMock = jest.fn();
const removeEventListenerMock = jest.fn();

Object.defineProperty(window, 'addEventListener', {
  value: addEventListenerMock,
  writable: true,
});

Object.defineProperty(window, 'removeEventListener', {
  value: removeEventListenerMock,
  writable: true,
});

describe('useNewsPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    addEventListenerMock.mockClear();
    removeEventListenerMock.mockClear();
  });

  it('should initialize with default state', () => {
    localStorageMock.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useNewsPopup());

    expect(result.current.isNewsPopupOpen).toBe(false);
    expect(result.current.newsContent).toBe('');
    expect(typeof result.current.handleClosePopup).toBe('function');
  });

  it('should add and remove event listeners on mount/unmount', () => {
    localStorageMock.getItem.mockReturnValue(null);

    const { unmount } = renderHook(() => useNewsPopup());

    expect(addEventListenerMock).toHaveBeenCalledWith('adguard-buddy:open-news', expect.any(Function));

    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledWith('adguard-buddy:open-news', expect.any(Function));
  });

  it('should open popup when custom event is dispatched', () => {
    localStorageMock.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useNewsPopup());

    expect(result.current.isNewsPopupOpen).toBe(false);

    // Simulate the event listener callback
    const eventCallback = addEventListenerMock.mock.calls[0][1];
    act(() => {
      eventCallback();
    });

    expect(result.current.isNewsPopupOpen).toBe(true);
  });

  it('should fetch news on mount and open popup for new content', async () => {
    const mockNewsData = {
      hash: 'new-hash-123',
      content: 'New news content here',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNewsData),
    });

    localStorageMock.getItem.mockReturnValue('old-hash-456');

    const { result } = renderHook(() => useNewsPopup());

    // Initially closed
    expect(result.current.isNewsPopupOpen).toBe(false);

    // Wait for the fetch to complete and state to update
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    // Wait for the state updates after fetch completes
    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(true);
    });

    expect(result.current.newsContent).toBe(mockNewsData.content);
  });

  it('should not open popup if news hash matches stored hash', async () => {
    const mockNewsData = {
      hash: 'same-hash-123',
      content: 'Same news content',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNewsData),
    });

    localStorageMock.getItem.mockReturnValue('same-hash-123');

    const { result } = renderHook(() => useNewsPopup());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    // Wait for the state updates after fetch completes
    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(false);
    });

    expect(result.current.newsContent).toBe('');
  });

  it('should not open popup if no stored hash exists', async () => {
    const mockNewsData = {
      hash: 'new-hash-123',
      content: 'New news content',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNewsData),
    });

    localStorageMock.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useNewsPopup());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    // Wait for the state updates after fetch completes
    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(true);
    });

    expect(result.current.newsContent).toBe(mockNewsData.content);
  });

  it('should handle fetch error gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    localStorageMock.getItem.mockReturnValue(null);

    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useNewsPopup());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    // Wait for the state updates after fetch completes
    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(false);
    });

    expect(result.current.newsContent).toBe('');

    consoleSpy.mockRestore();
  });

  it('should handle non-ok response gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    localStorageMock.getItem.mockReturnValue(null);

    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useNewsPopup());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    // Wait for the state updates after fetch completes
    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(false);
    });

    expect(result.current.newsContent).toBe('');

    consoleSpy.mockRestore();
  });

  it('should close popup and save hash when handleClosePopup is called', async () => {
    const mockNewsData = {
      hash: 'test-hash-123',
      content: 'Test news content',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNewsData),
    });

    localStorageMock.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useNewsPopup());

    // Wait for news to be fetched and popup to open
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(true);
    });

    // Now close the popup
    act(() => {
      result.current.handleClosePopup();
    });

    // Should save the current news hash
    expect(localStorageMock.setItem).toHaveBeenCalledWith('adguardBuddy_lastSeenNewsHash', 'test-hash-123');
  });

  it('should save current news hash when closing popup', async () => {
    const mockNewsData = {
      hash: 'save-hash-456',
      content: 'News to save',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNewsData),
    });

    localStorageMock.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useNewsPopup());

    // Wait for news to be fetched and popup to open
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(true);
    });

    // Close the popup
    act(() => {
      result.current.handleClosePopup();
    });

    // Should save the current news hash
    expect(localStorageMock.setItem).toHaveBeenCalledWith('adguardBuddy_lastSeenNewsHash', 'save-hash-456');
  });

  it('should handle localStorage errors gracefully when saving hash', () => {
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    const { result } = renderHook(() => useNewsPopup());

    // Should not throw error when localStorage fails
    expect(() => {
      act(() => {
        result.current.handleClosePopup();
      });
    }).not.toThrow();
  });

  it('should handle localStorage errors gracefully when reading hash', async () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage read error');
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hash: 'new-hash', content: 'content' }),
    });

    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useNewsPopup());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/news');
    });

    // Wait for the state updates after fetch completes
    await waitFor(() => {
      expect(result.current.isNewsPopupOpen).toBe(true);
    });

    consoleSpy.mockRestore();
  });
});
