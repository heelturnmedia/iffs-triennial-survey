import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand greens
        g1: '#1d7733',
        g2: '#0e5921',
        g3: '#e8f5ec',
        g4: '#d1ebd8',
        g5: '#2a9444',
        // Neutral / foreground
        bk: '#000000',
        f1: '#0d1117',
        f2: '#3d4a52',
        f3: '#7a8a96',
        f4: '#b0bec5',
        // Surface / background
        s1: '#f7f9f7',
        s2: '#f0f4f1',
        // Borders
        bd: '#e2ebe4',
        bd2: '#c8d9cc',
      },
      fontFamily: {
        display: ['Raleway', 'sans-serif'],
        body: ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 3px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04)',
        md: '0 4px 12px rgba(13,17,23,0.08), 0 2px 6px rgba(13,17,23,0.05)',
        lg: '0 8px 24px rgba(13,17,23,0.10), 0 4px 12px rgba(13,17,23,0.06)',
        'green-sm': '0 2px 8px rgba(29,119,51,0.15)',
        'green-md': '0 4px 16px rgba(29,119,51,0.20)',
        'green-lg': '0 8px 32px rgba(29,119,51,0.25)',
      },
      keyframes: {
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        expandRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        floatCard: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-8px) rotate(0.5deg)' },
          '66%': { transform: 'translateY(-4px) rotate(-0.3deg)' },
        },
        modalSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(-24px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        authFadeUp: {
          '0%': { opacity: '0', transform: 'translateY(32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        authFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        gridDraw: {
          '0%': { opacity: '0', strokeDashoffset: '1000' },
          '100%': { opacity: '1', strokeDashoffset: '0' },
        },
        floatDot: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        sHeaderIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-slide-up': 'fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-green': 'pulse 2s ease-in-out infinite',
        'expand-ring': 'expandRing 1.5s ease-out infinite',
        'float-card': 'floatCard 6s ease-in-out infinite',
        'modal-slide-in': 'modalSlideIn 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
        'auth-fade-up': 'authFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        'auth-fade-in': 'authFadeIn 0.5s ease forwards',
        'float-dot': 'floatDot 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        's-header-in': 'sHeaderIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
      },
    },
  },
  plugins: [],
}

export default config
