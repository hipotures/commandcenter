import { useEffect } from 'react';
import { useAppStore } from '../../state/store';

export function ThemeSync() {
  const { darkMode } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [darkMode]);

  return null;
}
