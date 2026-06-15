'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const OPTIONS: { value: Theme; label: string; detail: string; swatch: string }[] = [
  {
    value: 'dark',
    label: 'Dark',
    detail: 'Cinematic burgundy',
    swatch: 'bg-[#14100f]',
  },
  {
    value: 'light',
    label: 'Light',
    detail: 'Original warm mode',
    swatch: 'bg-[#f7f4f2]',
  },
];

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem('reading-app-theme', theme);
  } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              setTheme(option.value);
              applyTheme(option.value);
            }}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
              selected
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-stone-300 text-stone-600 hover:border-brand hover:text-brand'
            }`}
          >
            <span className={`h-8 w-8 flex-shrink-0 rounded-full border border-stone-300 ${option.swatch}`} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block truncate text-xs text-stone-500">{option.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
