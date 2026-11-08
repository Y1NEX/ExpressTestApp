import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#265a4b', dark: '#194234', light: '#edf5f1' },
    background: { default: '#f7f8f6', paper: '#ffffff' },
    text: { primary: '#20332c', secondary: '#617169' },
    divider: '#e3e9e4',
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
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 9, minHeight: 42 } },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 9 } } },
    MuiCssBaseline: {
      styleOverrides: {
        body: { margin: 0 },
        ':focus-visible': { outline: '3px solid #72a28c', outlineOffset: 3 },
      },
    },
  },
});
