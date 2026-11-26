import { useState } from 'react';
import { Link, useLoaderData, useNavigate } from 'react-router-dom';
import { tca } from '@itsezz/try-catch';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import { Shelf } from '../snippets/Shelf';
import type { PublicUser } from '@snippet/contracts';
import { logout } from '../auth/api';
import { errorMessage } from '../api/client';
import { Brand } from '../components/Brand';
import { PageTitle } from '../components/PageTitle';

export function HomePage() {
  const user = useLoaderData() as PublicUser;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await tca(() => logout());
    setBusy(false);
    if (!result.ok) {
      setFailure(errorMessage(result.error));
      return;
    }
    navigate('/login', { replace: true });
  }
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <PageTitle title="Startseite" />
      <Box
        component="header"
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 2.5 }}>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box
              component={Link}
              to="/"
              aria-label="SnippetShelf Startseite"
              sx={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Brand />
            </Box>
            <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  maxWidth: 270,
                  overflowWrap: 'anywhere',
                }}
              >
                {user.email}
              </Typography>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutRounded fontSize="small" />}
                disabled={busy}
                onClick={() => void signOut()}
              >
                {busy ? 'Abmelden …' : 'Abmelden'}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
      <Container
        component="main"
        maxWidth="lg"
        sx={{ flex: 1, py: { xs: 5, md: 8 } }}
      >
        {failure && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {failure}
          </Alert>
        )}
        <Shelf />
      </Container>
      <Container component="footer" maxWidth="lg" sx={{ pb: 3 }}>
        <Divider sx={{ mb: 2.5 }} />
        <Typography variant="caption" color="text.secondary">
          SnippetShelf · Deine Ideen, gut aufgehoben.
        </Typography>
      </Container>
    </Box>
  );
}
