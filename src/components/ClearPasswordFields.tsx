'use client';

import { useEffect } from 'react';

export default function ClearPasswordFields({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const clear = () => {
      document
        .querySelectorAll<HTMLInputElement>('input[type="password"]')
        .forEach((input) => {
          input.value = '';
        });
    };

    clear();
    const timer = window.setTimeout(clear, 150);
    return () => window.clearTimeout(timer);
  }, [active]);

  return null;
}
