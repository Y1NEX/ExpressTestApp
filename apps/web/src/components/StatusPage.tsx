import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link, useRevalidator, useRouteError } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { Brand } from './Brand';
import { PageTitle } from './PageTitle';

export function LoadingPage() {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}
    >
      <Stack spacing={3} sx={{ alignItems: 'center' }}>
        <Brand />
        <CircularProgress size={24} />
        <Typography color="text.secondary">Einen Moment …</Typography>
      </Stack>
    </Box>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 5, sm: 12 } }}>
      <PageTitle title="Verbindung unterbrochen" />
      <Brand />
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, mt: 5 }}>
        <Stack spacing={3}>
          <Typography variant="h1" sx={{ fontSize: '1.8rem' }}>
            Kurz nicht erreichbar.
          </Typography>
          <Typography role="alert" color="text.secondary">
            {errorMessage(error)}
          </Typography>
          <Button
            variant="contained"
            disabled={revalidator.state === 'loading'}
            onClick={() => revalidator.revalidate()}
          >
            Erneut versuchen
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export function NotFoundPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <PageTitle title="Seite nicht gefunden" />
      <Stack spacing={3}>
        <Brand />
        <Typography variant="h1">Hier ist noch nichts.</Typography>
        <Typography color="text.secondary">
          Diese Seite gibt es nicht.
        </Typography>
        <Button component={Link} to="/" variant="contained">
          Zur Startseite
        </Button>
      </Stack>
    </Container>
  );
}
