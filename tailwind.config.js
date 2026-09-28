import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        sm: '0.5rem',
        DEFAULT: '0.75rem',
        md: '0.875rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2rem',
      },
      boxShadow: {
        sm: '0 6px 20px -12px rgb(15 23 42 / 0.22)',
      },
      colors: {
        canvas: '#F4F7F4',
        surface: '#FFFFFF',
        ink: '#26312C',
        muted: '#5D6B63',
        line: '#DCE5DE',
        lotus: {
          50: '#F4F8F5',
          100: '#E8F1EB',
          200: '#D3E3D8',
          300: '#B5CFBE',
          400: '#8EB19A',
          500: '#679176',
          600: '#47765C',
          700: '#3B654D',
          800: '#31543F',
        },
        slate: {
          50: '#F4F7F4',
          100: '#EDF2EE',
          200: '#DCE5DE',
          300: '#C9D5CC',
          400: '#69776F',
          500: '#5D6B63',
          600: '#56645C',
          700: '#45524B',
          800: '#344039',
          900: '#26312C',
        },
        red: {
          50: '#fff9f8',
          100: '#ffefec',
        },
        rose: {
          50: '#fff8f8',
          100: '#ffefef',
        },
        orange: {
          50: '#fffaf6',
          100: '#fff1e7',
        },
        amber: {
          50: '#fffbf4',
          100: '#fff6e4',
        },
        emerald: {
          50: '#f5faf6',
          100: '#eaf5ec',
          400: '#9bc8a4',
        },
        sky: {
          50: '#f5fafc',
          100: '#eaf4f8',
        },
        blue: {
          50: '#f5f9fd',
          100: '#eaf2fa',
        },
        indigo: {
          50: '#f7f8fd',
          100: '#eef0fa',
        },
        violet: {
          50: '#faf8fd',
          100: '#f1edfa',
        },
        message: {
          50: '#F7F3FB',
          100: '#EEE6F7',
          500: '#9678C4',
          700: '#7552A2',
          800: '#5F4185',
        },
      },
    },
  },
  plugins: [forms],
}
