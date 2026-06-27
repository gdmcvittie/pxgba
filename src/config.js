export const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isDesktop;
export const API_BASE_URL = isDesktop ? 'http://localhost:3001' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001');
