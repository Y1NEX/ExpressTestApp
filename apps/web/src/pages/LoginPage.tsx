import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { tca } from '@itsezz/try-catch';
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { login, validateLogin } from '../auth/api';
import { errorMessage } from '../api/client';
import { Brand } from '../components/Brand';
import { PageTitle } from '../components/PageTitle';

export function LoginPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useFormik({
    initialValues: { email: '', password: '' },
    validate: validateLogin,
    onSubmit: async (values, helpers) => {
      setFailure(null);
      const result = await tca(() => login(values));
      if (!result.ok) {
        setFailure(errorMessage(result.error));
        return;
      }
      helpers.resetForm();
      navigate('/', { replace: true });
    },
  });
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <PageTitle title="Anmelden" />
      <Container maxWidth="lg" component="header" sx={{ py: 3 }}>
        <Brand />
      </Container>
      <Container
        component="main"
        maxWidth="sm"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          py: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 440, mx: 'auto' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="overline" color="primary">
              KLEINE IDEEN. GUT AUFGEHOBEN.
            </Typography>
            <Typography variant="h1" sx={{ mt: 1.5, mb: 1.5 }}>
              Willkommen zurück.
            </Typography>
            <Typography color="text.secondary">
              Dein Platz für Snippets und Textbausteine.
            </Typography>
          </Box>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 3, sm: 4 },
              boxShadow: '0 12px 40px #20332c06',
              borderRadius: 3,
            }}
          >
            <Box
              component="form"
              noValidate
              onSubmit={form.handleSubmit}
              aria-label="Anmeldung"
              aria-busy={form.isSubmitting}
            >
              <Stack spacing={2.5}>
                {failure && <Alert severity="error">{failure}</Alert>}
                <TextField
                  fullWidth
                  id="email"
                  name="email"
                  label="E-Mail-Adresse"
                  type="email"
                  autoComplete="username"
                  value={form.values.email}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  disabled={form.isSubmitting}
                  error={Boolean(form.touched.email && form.errors.email)}
                  helperText={form.touched.email && form.errors.email}
                  required
                  slotProps={{
                    htmlInput: { maxLength: 254, autoCapitalize: 'none' },
                  }}
                />
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  label="Passwort"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.values.password}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  disabled={form.isSubmitting}
                  error={Boolean(form.touched.password && form.errors.password)}
                  helperText={form.touched.password && form.errors.password}
                  required
                  slotProps={{
                    htmlInput: { maxLength: 256 },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            type="button"
                            aria-label={
                              visible
                                ? 'Passwort verbergen'
                                : 'Passwort anzeigen'
                            }
                            aria-pressed={visible}
                            edge="end"
                            disabled={form.isSubmitting}
                            onClick={() => setVisible(!visible)}
                          >
                            {visible ? (
                              <VisibilityOffOutlined fontSize="small" />
                            ) : (
                              <VisibilityOutlined fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={form.isSubmitting}
                  endIcon={!form.isSubmitting && <ArrowForwardRounded />}
                  sx={{ minHeight: 48 }}
                >
                  {form.isSubmitting ? 'Anmeldung läuft …' : 'Anmelden'}
                </Button>
              </Stack>
            </Box>
          </Paper>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              justifyContent: 'center',
              alignItems: 'center',
              mt: 3,
              color: 'text.secondary',
            }}
          >
            <LockOutlined sx={{ fontSize: 15 }} />
            <Typography variant="caption">Dein persönlicher Zugang.</Typography>
          </Stack>
        </Box>
      </Container>
      <Typography
        component="footer"
        variant="caption"
        color="text.secondary"
        align="center"
        sx={{ pb: 3 }}
      >
        Ein guter Platz für das, was du wieder brauchst.
      </Typography>
    </Box>
  );
}
