import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import { tca } from '@itsezz/try-catch';
import { categories, type Snippet, type SnippetList } from '@snippet/contracts';
import { ApiError, errorMessage } from '../api/client';
import { deleteSnippet, loadLabels, loadSnippets, saveSnippet } from './api';
import { SnippetCard } from './SnippetCard';
import { Editor } from './Editor';
import { CopyButton } from './CopyButton';
import { categoryNames, templates } from './templates';

const defaults = {
  search: '',
  category: '',
  label: '',
  favorites: false,
  page: 1,
};
export function Shelf() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaults);
  const [grouped, setGrouped] = useState(false);
  const [revision, refresh] = useState(0);
  const [labels, setLabels] = useState<string[]>([]);
  const [list, setList] = useState<SnippetList>();
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [editor, setEditor] = useState<Snippet | 'new' | number>();
  const [showTemplates, setShowTemplates] = useState(false);
  const [removing, setRemoving] = useState<Snippet>();
  const { search, category, label, favorites, page } = filters;
  useEffect(() => {
    const controller = new AbortController();
    setList(undefined);
    setLoadError('');
    const query = new URLSearchParams({ page: String(page), pageSize: '12' });
    if (search.trim()) query.set('search', search.trim());
    if (category) query.set('category', category);
    if (label) query.set('label', label);
    if (favorites) query.set('favorite', 'true');
    async function read() {
      const result = await tca(() =>
        loadSnippets(query.toString(), controller.signal),
      );
      if (controller.signal.aborted) return;
      if (!result.ok) {
        if (
          result.error instanceof ApiError &&
          result.error.code === 'UNAUTHENTICATED'
        ) {
          void navigate('/login', { replace: true });
          return;
        }
        setLoadError(errorMessage(result.error));
        return;
      }
      const last = Math.max(1, result.data.pagination.totalPages);
      if (page > last) {
        setFilters((current) => ({ ...current, page: last }));
        return;
      }
      setList(result.data);
    }
    void read();
    return () => controller.abort();
  }, [category, favorites, label, navigate, page, revision, search]);
  const [labelsError, setLabelsError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      const result = await tca(() => loadLabels(controller.signal));
      if (controller.signal.aborted) return;
      if (result.ok) {
        setLabels(result.data.data);
        setLabelsError('');
      } else setLabelsError('Labels konnten nicht geladen werden.');
    }
    void read();
    return () => controller.abort();
  }, [revision]);
  const reload = () => refresh((n) => n + 1);
  function filter(change: Partial<typeof defaults>) {
    setFilters((current) => ({ ...current, ...change, page: 1 }));
  }
  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setFailure('');
    const result = await tca(action);
    setBusy(false);
    if (!result.ok) {
      setFailure(errorMessage(result.error));
      return;
    }
    setRemoving(undefined);
    reload();
  }
  const groups = new Map<string, Snippet[]>();
  for (const snippet of list?.data ?? []) {
    const keys = grouped
      ? snippet.labels.length
        ? snippet.labels
        : ['']
      : [''];
    for (const key of keys) {
      const entries = groups.get(key) ?? [];
      entries.push(snippet);
      groups.set(key, entries);
    }
  }
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          alignItems: { xs: 'start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Typography variant="h1">Meine Snippets</Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => setShowTemplates(true)}>
            Befehlsvorlagen
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => setEditor('new')}
          >
            Neues Snippet
          </Button>
        </Stack>
      </Stack>
      <Box component="section" aria-label="Sammlung filtern">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          <TextField
            size="small"
            label="Suche in Titel und Code"
            type="search"
            value={search}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            onChange={(event) => filter({ search: event.target.value })}
          />
          <TextField
            select
            size="small"
            label="Kategorie"
            value={category || 'all'}
            onChange={(event) =>
              filter({
                category:
                  event.target.value === 'all' ? '' : event.target.value,
              })
            }
          >
            <MenuItem value="all">Alle Kategorien</MenuItem>
            {categories.map((key) => (
              <MenuItem key={key} value={key}>
                {categoryNames[key]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Ausführungsumgebung"
            value={label}
            slotProps={{
              select: { displayEmpty: true },
              inputLabel: { shrink: true },
            }}
            onChange={(event) => filter({ label: event.target.value })}
          >
            <MenuItem value="">Alle Labels</MenuItem>
            {[...new Set([...labels, ...(label ? [label] : [])])].map(
              (item) => (
                <MenuItem value={item} key={item}>
                  {item}
                </MenuItem>
              ),
            )}
          </TextField>
        </Box>
        <Stack direction="row" sx={{ flexWrap: 'wrap', mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={favorites}
                onChange={(event) =>
                  filter({ favorites: event.target.checked })
                }
              />
            }
            label="Nur Favoriten"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={grouped}
                onChange={(event) => setGrouped(event.target.checked)}
              />
            }
            label="Nach Labels gruppieren"
          />
        </Stack>
      </Box>
      {(loadError || labelsError) && (
        <Alert
          severity="error"
          action={<Button onClick={reload}>Erneut laden</Button>}
        >
          {loadError || labelsError}
        </Alert>
      )}
      {failure && !removing && <Alert severity="error">{failure}</Alert>}
      {!list && !loadError && (
        <Typography role="status">Sammlung wird geladen …</Typography>
      )}
      {list && (
        <Typography variant="body2" color="text.secondary" role="status">
          {list.pagination.total}{' '}
          {list.pagination.total === 1 ? 'Snippet' : 'Snippets'}
        </Typography>
      )}
      {list && !list.data.length && (
        <Box>
          <Typography variant="h2">
            {search || category || label || favorites
              ? 'Keine passenden Snippets'
              : 'Deine Sammlung ist noch leer'}
          </Typography>
          {search || category || label || favorites ? (
            <Button onClick={() => setFilters(defaults)}>
              Filter zurücksetzen
            </Button>
          ) : (
            <Typography color="text.secondary">
              Lege dein erstes Snippet an oder starte mit einer Vorlage.
            </Typography>
          )}
        </Box>
      )}
      {Array.from(groups)
        .sort(([a], [b]) => a.localeCompare(b, 'de'))
        .map(([key, items]) => (
          <Box key={key}>
            {grouped && (
              <Typography
                variant="h2"
                sx={{ mb: 1.5, overflowWrap: 'anywhere' }}
              >
                {key || 'Ohne Label'}
              </Typography>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  md: 'repeat(2,minmax(0, 1fr))',
                },
                gap: 2,
              }}
            >
              {items.map((snippet) => (
                <SnippetCard
                  key={snippet.id + '-' + snippet.updatedAt}
                  snippet={snippet}
                  busy={busy}
                  edit={() => setEditor(snippet)}
                  remove={() => {
                    setFailure('');
                    setRemoving(snippet);
                  }}
                  toggleFavorite={() =>
                    void mutate(() =>
                      saveSnippet({ favorite: !snippet.favorite }, snippet.id),
                    )
                  }
                  filter={(value) => filter({ label: value })}
                />
              ))}
            </Box>
          </Box>
        ))}
      {list && list.pagination.totalPages > 1 && (
        <Pagination
          size="small"
          siblingCount={0}
          count={list.pagination.totalPages}
          page={page}
          onChange={(_, next) =>
            setFilters((current) => ({ ...current, page: next }))
          }
        />
      )}
      {showTemplates && (
        <Dialog
          open
          fullWidth
          maxWidth="sm"
          aria-labelledby="templates-title"
          onClose={() => setShowTemplates(false)}
        >
          <DialogTitle id="templates-title">Befehlsvorlagen</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3}>
              {templates.map((sample, index) => (
                <Box
                  component="article"
                  aria-label={sample.title}
                  key={sample.title}
                >
                  <Typography variant="h2">{sample.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {categoryNames[sample.category]} ·{' '}
                    {sample.labels.join(', ')}
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      overflowX: 'auto',
                      p: 1.5,
                      bgcolor: 'action.selected',
                    }}
                  >
                    <code>{sample.content}</code>
                  </Box>
                  <Stack
                    direction="row"
                    sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <CopyButton content={sample.content} />
                    <Button
                      size="small"
                      onClick={() => {
                        setShowTemplates(false);
                        setEditor(index);
                      }}
                    >
                      Als Snippet anpassen
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTemplates(false)}>Schließen</Button>
          </DialogActions>
        </Dialog>
      )}
      {editor !== undefined && (
        <Editor
          snippet={typeof editor === 'object' ? editor : undefined}
          initialTemplate={typeof editor === 'number' ? editor : undefined}
          close={() => setEditor(undefined)}
          saved={() => {
            if (typeof editor !== 'object') setFilters(defaults);
            setEditor(undefined);
            reload();
          }}
        />
      )}
      {removing && (
        <Dialog
          open
          aria-labelledby="delete-title"
          onClose={busy ? undefined : () => setRemoving(undefined)}
        >
          <DialogTitle id="delete-title">Snippet löschen?</DialogTitle>
          <DialogContent sx={{ overflowWrap: 'anywhere' }}>
            „{removing.title}“ wird dauerhaft gelöscht.
            {failure && <Alert severity="error">{failure}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button
              autoFocus
              disabled={busy}
              onClick={() => {
                setRemoving(undefined);
                setFailure('');
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy}
              onClick={() => void mutate(() => deleteSnippet(removing.id))}
            >
              Endgültig löschen
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}
