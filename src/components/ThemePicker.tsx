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
      const root = document.documentElement;
      // A theme flip only rewrites custom properties, so any element carrying a
      // colour transition would animate away from the *old* theme's value and
      // sit on the wrong colour for the duration. Suppress transitions across
      // the swap (see the [data-theme-switching] rule in reset.css), then force
      // one synchronous style/layout flush so the new colours are computed while
      // transitions are still off. The flush is what makes this correct without
      // a rAF — a background tab never gets frames, and the suppression must not
      // outlive the swap.
      const switching = root.dataset.theme !== resolved;
      if (switching) root.dataset.themeSwitching = '';
      root.dataset.theme = resolved;
      if (switching) {
        root.getBoundingClientRect();
        delete root.dataset.themeSwitching;
      }
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'dark' ? '#16191d' : '#ffffff');
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
    <span className="theme-picker">
      <Icon size={15} aria-hidden="true" />
      <label className="sr-only" htmlFor="theme-select">
        Colour theme
      </label>
      <select
        id="theme-select"
        className="control-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </span>
  );
}
