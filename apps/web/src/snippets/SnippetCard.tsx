import { CopyButton } from './CopyButton';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import type { Snippet } from '@snippet/contracts';
import { categoryNames } from './templates';

type Props = {
  snippet: Snippet;
  busy: boolean;
  edit: () => void;
  remove: () => void;
  toggleFavorite: () => void;
  filter: (label: string) => void;
};
export function SnippetCard({
  snippet,
  busy,
  edit,
  remove,
  toggleFavorite,
  filter,
}: Props) {
  return (
    <Paper
      component="article"
      variant="outlined"
      aria-label={snippet.title}
      sx={{
        minWidth: 0,
        p: { xs: 2, sm: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {categoryNames[snippet.category]}
          </Typography>
          <Typography
            component="h3"
            variant="h2"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {snippet.title}
          </Typography>
        </Box>
        <IconButton
          aria-label="Favorit"
          aria-pressed={snippet.favorite}
          onClick={toggleFavorite}
          disabled={busy}
        >
          {snippet.favorite ? (
            <StarRounded color="primary" />
          ) : (
            <StarBorderRounded />
          )}
        </IconButton>
      </Stack>
      <Box
        component="pre"
        tabIndex={0}
        aria-label="Snippet-Inhalt"
        sx={{
          m: 0,
          p: 2,
          bgcolor: 'action.selected',
          borderRadius: 1,
          fontSize: 14,
          lineHeight: 1.65,
          maxHeight: 220,
          overflow: 'auto',
          minHeight: 54,
        }}
      >
        <code>{snippet.content}</code>
      </Box>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
        {snippet.labels.map((label) => (
          <Chip
            size="small"
            key={label}
            label={label}
            onClick={() => filter(label)}
          />
        ))}
      </Stack>
      <Stack
        direction="row"
        sx={{ gap: 0.5, alignItems: 'center', flexWrap: 'wrap', mt: 'auto' }}
      >
        <CopyButton content={snippet.content} />
        <Button size="small" onClick={edit} disabled={busy}>
          Bearbeiten
        </Button>
        <Button size="small" color="inherit" onClick={remove} disabled={busy}>
          Löschen
        </Button>
      </Stack>
    </Paper>
  );
}
