import type { Config } from 'tailwindcss';

/**
 * Tailwind config for the 619 ERP "Aurora" glass UI.
 * The design system is primarily driven by globals.css custom properties +
 * utility classes — Tailwind here is for ad-hoc layout helpers only.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--rgb-brand) / <alpha-value>)',
          hi: 'rgb(var(--rgb-brand-hi) / <alpha-value>)',
        },
        ink: 'rgb(var(--rgb-text) / <alpha-value>)',
        ink2: 'rgb(var(--rgb-text-2) / <alpha-value>)',
        muted: 'rgb(var(--rgb-muted) / <alpha-value>)',
      },
      backdropBlur: {
        xs: '2px',
        glass: '18px',
      },
      borderRadius: {
        glass: '18px',
      },
    },
  },
  plugins: [],
};

export default config;
