// MockMate Global Client Configurations
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Global Fetch with Timeout utility (default 8 seconds)
export const fetchWithTimeout = async (url, options = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};
