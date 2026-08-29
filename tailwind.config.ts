import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#07070a',
          900: '#0a0a0e',
          800: '#101015',
          700: '#16161d',
          600: '#1e1e27',
          500: '#282833',
          400: '#3a3a47',
        },
        gold: {
          50: '#fdf8e7',
          100: '#f9edc2',
          200: '#f2dc90',
          300: '#e9c65c',
          400: '#dfb337',
          500: '#d4af37',
          600: '#b08d24',
          700: '#8a6c1a',
          800: '#5f4a12',
          900: '#3b2e0b',
        },
        bone: {
          DEFAULT: '#f5f1e8',
          muted: '#c7c1b4',
          dim: '#8b857a',
        },
        blood: '#c1121f',
        jade: '#1f9e6b',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'Haettenschweiler', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '10xl': ['9rem', { lineHeight: '0.85', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.35), 0 18px 48px -24px rgba(212,175,55,0.55)',
        lift: '0 24px 60px -30px rgba(0,0,0,0.9)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gold-sheen':
          'linear-gradient(100deg, #8a6c1a 0%, #d4af37 22%, #f7e7a8 46%, #d4af37 68%, #8a6c1a 100%)',
        'ink-fade': 'linear-gradient(180deg, rgba(7,7,10,0) 0%, rgba(7,7,10,0.75) 55%, #07070a 100%)',
        'ink-side': 'linear-gradient(90deg, #07070a 0%, rgba(7,7,10,0.9) 40%, rgba(7,7,10,0.15) 100%)',
        'panel-sheen': 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-700px 0' },
          '100%': { backgroundPosition: '700px 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'bar-pulse': {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease both',
        shimmer: 'shimmer 1.6s linear infinite',
        marquee: 'marquee 28s linear infinite',
        'bar-pulse': 'bar-pulse 0.9s ease-in-out infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      maxWidth: {
        '8xl': '90rem',
      },
    },
  },
  plugins: [],
};

export default config;
