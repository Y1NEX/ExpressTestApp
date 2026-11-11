import { createTheme } from '@mui/material/styles';

const focusRing = {
  outline: '3px solid var(--mui-palette-primary-main)',
  outlineOffset: 3,
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#123c2c', dark: '#0d2d21', contrastText: '#ffffff' },
        secondary: { main: '#3c4340', contrastText: '#ffffff' },
        background: { default: '#f5f7f6', paper: '#ffffff' },
        text: { primary: '#19241e', secondary: '#52615a' },
        divider: '#dbe2de',
        action: { active: '#7d8982', selected: '#e7efea' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#80ba9d', dark: '#6faa8e', contrastText: '#101412' },
        secondary: { main: '#cad1cd', contrastText: '#101412' },
        background: { default: '#101412', paper: '#191f1c' },
        text: { primary: '#f2f5f3', secondary: '#b6c0bb' },
        divider: '#36413b',
        action: { active: '#72837a', selected: '#23392f' },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", Inter, system-ui, -apple-system, sans-serif',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
      letterSpacing: '-0.045em',
      lineHeight: 1.18,
    },
    h2: { fontSize: '1.35rem', fontWeight: 650, letterSpacing: '-0.025em' },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.13em' },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: { root: { '&.Mui-focusVisible': focusRing } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 9, minHeight: 42 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 9 },
        notchedOutline: { borderColor: 'var(--mui-palette-action-active)' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: { margin: 0 },
        'a:focus-visible': focusRing,
      },
    },
  },
});
