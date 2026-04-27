import preset from '../tailwind.preset.js';

/**
 * 908-doha-design-system Tailwind preset is the source of truth for:
 *   - 4pt spacing scale (1=2px, 2=4px, 3=8px, 4=12px, 5=16px ...)
 *   - semantic colour classes (bg-surface, text-primary, bg-brand, ...)
 *   - typography tokens (text-display, text-title1, text-heading1 ...)
 *   - elev-1..4 shadows + duration/ease tokens
 *   - dark mode flip via [data-theme="dark"]
 *
 * Components in 908-doha-ui/components/** are scanned so any utility
 * class they reference makes it into the production CSS bundle.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../908-doha-ui/components/**/*.{js,jsx}',
    '../908-doha-ui/contexts/**/*.{js,jsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
