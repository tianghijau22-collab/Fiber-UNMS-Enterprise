import { defineConfig } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default defineConfig({
  darkMode: 'class',
  content: [
    './resources/**/*.blade.php',
    './resources/**/*.js',
    './resources/**/*.jsx',
    './resources/**/*.ts',
    './resources/**/*.tsx',
    './resources/**/*.css',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
})
