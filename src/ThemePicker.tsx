import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('partyfinder.theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* preferences are optional */
    }
    return 'system';
  });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'dark' ? '#111827' : '#f7f9fc');
    };
    apply();
    media.addEventListener('change', apply);
    try {
      localStorage.setItem('partyfinder.theme', theme);
    } catch {
      /* optional */
    }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  return (
    <label className="theme-picker">
      <Icon size={15} />
      <select
        aria-label="Color theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
