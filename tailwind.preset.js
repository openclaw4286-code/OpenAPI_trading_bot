/**
 * 908 Doha Design System — Tailwind Preset
 *
 * Usage (tailwind.config.js):
 *   import preset from '908-doha-design-system/tailwind';
 *   export default { presets: [preset], content: ['./src/**\/*.{html,js,jsx,ts,tsx}'] };
 *
 * This preset maps 908 tokens onto Tailwind's theme. Include the
 * companion stylesheet `908-doha-design-system/dist/908-doha.css`
 * in your app entry so the CSS variables are defined at runtime.
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Primitives
        grey: {
          50:  '#FAF9F6', 100: '#F2F0EB', 200: '#E5E2DA', 300: '#CECABE',
          400: '#9A9588', 500: '#747067', 600: '#53504A', 700: '#34312D',
          800: '#1A1815', 900: '#0A0907',
        },
        primary: {
          50:  '#E8F1FF', 100: '#CCE0FF', 200: '#99C1FF', 300: '#66A1FF',
          400: '#3382FF', 500: '#0064FF', 600: '#0051CC', 700: '#003D99',
          800: '#002966', 900: '#001633',
          DEFAULT: '#0064FF',
        },
        red: {
          50: '#FDECEA', 100: '#FBD3CF', 200: '#F6A7A0', 300: '#EE7A71',
          400: '#E15347', 500: '#D23826', 600: '#AC2B1C', 700: '#851F14',
          800: '#5E160E', 900: '#380B07',
        },
        green: {
          50: '#E9F5EC', 100: '#CEE8D4', 200: '#9ED2AB', 300: '#6BB982',
          400: '#3E9F5E', 500: '#1E8443', 600: '#166934', 700: '#0F4E26',
          800: '#09361A', 900: '#04200F',
        },
        orange: {
          50: '#FBEFE3', 100: '#F6DBBC', 200: '#EFBB85', 300: '#E59A52',
          400: '#D57B29', 500: '#B5610F', 600: '#904C0A', 700: '#6B3807',
          800: '#4A2604', 900: '#2B1602',
        },
        yellow: {
          50: '#FBF3D6', 100: '#F6E6A7', 200: '#EDD468', 300: '#DCBB2D',
          400: '#BE9D12', 500: '#95790A', 600: '#735C06', 700: '#524204',
          800: '#332902', 900: '#1B1601',
        },
        teal: {
          50: '#E4F4F4', 100: '#BFE4E4', 200: '#82C9C9', 300: '#48ACAC',
          400: '#1E8C8C', 500: '#0A6E6E', 600: '#075757', 700: '#054040',
          800: '#042C2C', 900: '#021818',
        },
        purple: {
          50: '#EFEAF5', 100: '#DACEE7', 200: '#B49ECF', 300: '#8D6FB3',
          400: '#6B4B95', 500: '#4F3478', 600: '#3E2960', 700: '#2E1E48',
          800: '#1E1330', 900: '#0F091B',
        },

        // Semantic tokens — map to CSS variables so dark mode works via [data-theme="dark"]
        background:        'var(--background)',
        surface:           'var(--surface)',
        'surface-layered': 'var(--surface-layered)',
        'surface-sunken':  'var(--surface-sunken)',
        'surface-inverse': 'var(--surface-inverse)',

        'text-primary':    'var(--text-primary)',
        'text-secondary':  'var(--text-secondary)',
        'text-tertiary':   'var(--text-tertiary)',
        'text-inverted':   'var(--text-inverted)',
        'text-brand':      'var(--text-brand)',
        'text-link':       'var(--text-link)',

        'border-subtle':   'var(--border-subtle)',
        'border-default':  'var(--border-default)',
        'border-strong':   'var(--border-strong)',
        'border-focus':    'var(--border-focus)',

        'brand':           'var(--accent-brand)',
        'brand-hover':     'var(--accent-brand-hover)',
        'brand-press':     'var(--accent-brand-press)',
        'brand-soft':      'var(--accent-brand-soft)',

        'positive':        'var(--state-positive)',
        'positive-soft':   'var(--state-positive-soft)',
        'negative':        'var(--state-negative)',
        'negative-soft':   'var(--state-negative-soft)',
        'warning':         'var(--state-warning)',
        'warning-soft':    'var(--state-warning-soft)',
        'info':            'var(--state-info)',
        'info-soft':       'var(--state-info-soft)',
      },

      fontFamily: {
        sans:   ['Pretendard Variable', 'Pretendard', '-apple-system', 'SF Pro Text', 'Helvetica Neue', 'Noto Kufi Arabic', 'system-ui', 'sans-serif'],
        serif:  ['Fraunces', 'Times New Roman', 'Georgia', 'serif'],
        mono:   ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        arabic: ['Noto Kufi Arabic', 'Pretendard Variable', 'sans-serif'],
      },

      fontSize: {
        // Role tokens — [size, { lineHeight, letterSpacing, fontWeight }]
        display:  ['40px', { lineHeight: '48px', letterSpacing: '-0.02em',  fontWeight: '700' }],
        title1:   ['32px', { lineHeight: '40px', letterSpacing: '-0.015em', fontWeight: '700' }],
        title2:   ['26px', { lineHeight: '34px', letterSpacing: '-0.012em', fontWeight: '600' }],
        title3:   ['22px', { lineHeight: '30px', letterSpacing: '-0.01em',  fontWeight: '600' }],
        heading1: ['18px', { lineHeight: '26px', letterSpacing: '-0.006em', fontWeight: '600' }],
        heading2: ['16px', { lineHeight: '24px', letterSpacing: '-0.004em', fontWeight: '600' }],
        body1:    ['16px', { lineHeight: '26px', letterSpacing: '-0.003em', fontWeight: '400' }],
        body2:    ['14px', { lineHeight: '22px', letterSpacing: '-0.002em', fontWeight: '400' }],
        label:    ['13px', { lineHeight: '18px', letterSpacing: '0',        fontWeight: '500' }],
        caption:  ['12px', { lineHeight: '16px', letterSpacing: '0',        fontWeight: '400' }],
      },

      fontWeight: {
        light: '300', regular: '400', medium: '500', semibold: '600', bold: '700',
      },

      spacing: {
        // 908 4pt scale (mapped to token names, plus Tailwind-compatible numeric aliases)
        '1': '2px',  '2': '4px',   '3': '8px',   '4': '12px',
        '5': '16px', '6': '20px',  '7': '24px',  '8': '32px',
        '9': '40px', '10': '48px', '11': '64px', '12': '80px',
      },

      borderRadius: {
        xs:   '4px',
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '20px',
        '2xl':'28px',
        full: '9999px',
      },

      boxShadow: {
        'elev-0': 'none',
        'elev-1': '0 1px 2px rgba(26, 24, 21, 0.04), 0 1px 1px rgba(26, 24, 21, 0.03)',
        'elev-2': '0 2px 6px rgba(26, 24, 21, 0.06), 0 1px 2px rgba(26, 24, 21, 0.04)',
        'elev-3': '0 8px 20px rgba(26, 24, 21, 0.08), 0 2px 6px rgba(26, 24, 21, 0.05)',
        'elev-4': '0 18px 40px rgba(26, 24, 21, 0.12), 0 4px 12px rgba(26, 24, 21, 0.06)',
      },

      transitionDuration: {
        fast:   '160ms',
        normal: '280ms',
        slow:   '480ms',
        xslow:  '720ms',
      },

      transitionTimingFunction: {
        soft:     'cubic-bezier(0.32, 0.72, 0, 1)',
        emphasis: 'cubic-bezier(0.2, 0, 0, 1)',
        spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
};

export default preset;
module.exports = preset;
