/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  safelist: ['product-size-option', 'product-size-options', 'product-size-option__label'],
  theme: {
    extend: {
      colors: {
        // Global colors via CSS variables - edit in app.css
        white: 'var(--color-white)',
        black: 'var(--color-black)',
        dark: {
          DEFAULT: 'var(--color-dark)',
          light: 'var(--color-dark-light)',
          lighter: 'var(--color-dark-lighter)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          muted: 'var(--color-accent-muted)',
          light: 'var(--color-accent-light)',
        },
        background: {
          DEFAULT: 'var(--color-background)',
          secondary: 'var(--color-background-secondary)',
        },
      },
      fontFamily: {
        sans: ['var(--font-family)', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        h1: 'var(--font-size-h1)',
        h2: 'var(--font-size-h2)',
        h3: 'var(--font-size-h3)',
        h4: 'var(--font-size-h4)',
        body: 'var(--font-size-body)',
        small: 'var(--font-size-small)',
        button: 'var(--font-size-button)',
      },
      borderRadius: {
        card: 'var(--border-radius-card)',
        button: 'var(--border-radius-button)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
