/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // The SDK stylesheet scopes its resets under `.rtsdk` (on <body>), giving rules like
  // `.rtsdk p { color; font-size; font-weight; ... }` a specificity of (0,1,1) — which beats every
  // bare Tailwind utility at (0,1,0). Generating utilities as `.rtsdk .text-xs` lifts them to (0,2,0)
  // so they win, instead of silently losing on every <p>, <h*> and .card in the app.
  important: ".rtsdk",
  theme: {
    extend: {
      fontFamily: {
        display: ['"Righteous"', 'cursive'],
        body: ['"Albert Sans"', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#D94F30',
          hover: '#C04328',
          soft: '#FCEEE9',
        },
        secondary: {
          DEFAULT: '#1B4965',
          light: '#2A6F97',
        },
        accent: {
          DEFAULT: '#F5CB5C',
          glow: '#FFF3C4',
        },
        surface: '#FFFFFF',
        parchment: '#FAF7F2',
        ink: '#1E293B',
        'ink-soft': '#64748B',
        'ink-muted': '#9BABC0',
        success: {
          DEFAULT: '#059669',
          bg: '#D1FAE5',
        },
        warm: {
          border: '#E2DDD5',
          100: '#F5F0EB',
          200: '#EBE4DB',
        },
        selected: {
          DEFAULT: '#EBF0FF',
          border: '#6B8FD4',
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(27, 73, 101, 0.08)',
        'card-hover': '0 6px 24px rgba(27, 73, 101, 0.14)',
        'glow': '0 0 20px rgba(245, 203, 92, 0.3)',
        'btn': '0 4px 14px rgba(217, 79, 48, 0.25)',
        'btn-hover': '0 6px 20px rgba(217, 79, 48, 0.35)',
      },
      keyframes: {
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(3deg)' },
        },
        gentlePulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        confettiDrop: {
          '0%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateY(120px) rotate(720deg)' },
        },
        starBurst: {
          '0%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1.2) rotate(180deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(360deg)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        spinLoader: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fadeSlideUp 0.5s ease-out forwards',
        'fade-up-1': 'fadeSlideUp 0.5s ease-out 0.1s forwards',
        'fade-up-2': 'fadeSlideUp 0.5s ease-out 0.2s forwards',
        'fade-up-3': 'fadeSlideUp 0.5s ease-out 0.3s forwards',
        'fade-up-4': 'fadeSlideUp 0.5s ease-out 0.4s forwards',
        'fade-up-5': 'fadeSlideUp 0.5s ease-out 0.5s forwards',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-slower': 'float 10s ease-in-out infinite',
        'gentle-pulse': 'gentlePulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'confetti': 'confettiDrop 1.2s ease-in forwards',
        'star-burst': 'starBurst 0.6s ease-out forwards',
        'bounce-in': 'bounceIn 0.6s ease-out forwards',
        'spin-loader': 'spinLoader 1s linear infinite',
      },
    },
  },
  plugins: [],
}
