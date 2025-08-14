const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@spartan-ng/ui-core/hlm-tailwind-preset')],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      opacity: {
        15: '0.15',
        20: '0.20',
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      fontSize: {
        base: ['18px'],
      },
      screens: {
        '2.5xl': '1700px',
      },
      spacing: {
        container: '1rem',
        content: '0.75rem',
      },
      colors: {
        primary: 'var(--sh-color-primary)',
        'primary-shade': 'var(--sh-color-primary-shade)',
        'primary-tint': 'var(--sh-color-primary-tint)',
        'primary-contrast': 'var(--sh-color-primary-contrast)',

        secondary: 'var(--sh-color-secondary)',
        'secondary-shade': 'var(--sh-color-secondary-shade)',
        'secondary-tint': 'var(--sh-color-secondary-tint)',
        'secondary-contrast': 'var(--sh-color-secondary-contrast)',

        tertiary: 'var(--sh-color-tertiary)',
        'tertiary-shade': 'var(--sh-color-tertiary-shade)',
        'tertiary-tint': 'var(--sh-color-tertiary-tint)',
        'tertiary-contrast': 'var(--sh-color-tertiary-contrast)',

        header: '#004C69',
        navbg: 'var(--sh-color-primary-contrast)',
        questionProgress: '#2095D5',

        background: '#F3F3F3',
        'background-shade': 'var(--sh-background-color-shade)',
        'background-tint': 'var(--sh-background-color-tint)',
        'background-contrast': 'var(--sh-background-color-contrast)',

        content: 'var(--sh-color-content)',
        'content-contrast': 'var(--sh-color-content-contrast)',
        warning: 'var(--sh-color-warning)',
        'warning-contrast': 'var(--sh-color-warning-contrast)',
        'warning-shade': 'var(--sh-color-warning-shade)',
        'warning-tint': 'var(--sh-color-warning-tint)',
        success: 'var(--sh-color-success)',
        'input-background': 'var(--sh-input-background-color)',
        danger: 'var(--sh-color-danger)',
        'danger-contrast': 'var(--sh-color-danger-contrast)',
        medium: 'var(--sh-color-medium)',
        'medium-shade': 'var(--sh-color-medium-shade)',
        'medium-tint': 'var(--sh-color-medium-tint)',
        dark: 'var(--sh-color-dark)',
        'dark-tint': 'var(--sh-color-dark-tint)',
        light: 'var(--sh-color-light)',
        'light-tint': 'var(--sh-color-light-tint)',

        text: 'var(--sh-text-color)',

        step50: 'var(--sh-color-step-50)',
        step100: 'var(--sh-color-step-100)',
        step150: 'var(--sh-color-step-150)',
        step200: 'var(--sh-color-step-200)',
        step250: 'var(--sh-color-step-250)',
        step300: 'var(--sh-color-step-300)',
        step350: 'var(--sh-color-step-350)',
        step400: 'var(--sh-color-step-400)',
        step450: 'var(--sh-color-step-450)',
        step500: 'var(--sh-color-step-500)',
        step550: 'var(--sh-color-step-550)',
        step600: 'var(--sh-color-step-600)',
        step650: 'var(--sh-color-step-650)',
        step700: 'var(--sh-color-step-700)',
        step750: 'var(--sh-color-step-750)',
        step800: 'var(--sh-color-step-800)',
        step850: 'var(--sh-color-step-850)',
        step900: 'var(--sh-color-step-900)',
        step950: 'var(--sh-color-step-950)',
      },
    },
  },
  plugins: [],
  variants: {
    extend: {
      backgroundColor: ['checked', 'peer-checked', 'group-hover'],
      borderColor: ['checked', 'peer-checked', 'group-hover'],
      opacity: ['checked', 'peer-checked'],
      scale: ['checked', 'peer-checked'],
      textColor: ['checked', 'peer-checked'],
    },
  },
};
