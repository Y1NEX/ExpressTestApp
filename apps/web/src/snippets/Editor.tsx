import { useState } from 'react';
import { useFormik } from 'formik';
import { tca } from '@itsezz/try-catch';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import {
  categories,
  createSnippetSchema,
  type Category,
  type UpdateSnippet,
  type Snippet,
} from '@snippet/contracts';
import { errorMessage } from '../api/client';
import { saveSnippet } from './api';
import { categoryNames, templates } from './templates';

export function Editor({
  snippet,
  close,
  saved,
}: {
  snippet?: Snippet;
  close: () => void;
  saved: () => void;
}) {
  const [failure, setFailure] = useState('');
  const [template, setTemplate] = useState('');
  const initialValues = {
    title: snippet?.title ?? '',
    content: snippet?.content ?? '',
    category: snippet?.category ?? ('OTHER' as Category),
    favorite: snippet?.favorite ?? false,
    labels: snippet?.labels.join(', ') ?? '',
  };
  function parse(values: typeof initialValues) {
    return createSnippetSchema.safeParse({
      ...values,
      labels: values.labels
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }
  const form = useFormik({
    initialValues,
    validate(values) {
      const result = parse(values);
      const errors: Partial<Record<keyof typeof values, string>> = {};
      if (!result.success)
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === 'title')
            errors.title = 'Bitte gib einen Titel mit 1–120 Zeichen ein.';
          if (key === 'content')
            errors.content =
              'Bitte gib Code oder Text mit höchstens 50.000 Zeichen ein.';
          if (key === 'labels')
            errors.labels =
              'Maximal 12 Labels mit je 1–32 Zeichen. Beginne mit einem Buchstaben oder einer Zahl.';
        }
      return errors;
    },
    async onSubmit(values) {
      const parsed = parse(values);
      if (!parsed.success) return;
      setFailure('');
      const value = parsed.data;
      let payload: UpdateSnippet = value;
      if (snippet) {
        payload = {};
        if (snippet.title !== value.title) payload.title = value.title;
        if (snippet.content !== value.content) payload.content = value.content;
        if (snippet.category !== value.category)
          payload.category = value.category;
        if (snippet.favorite !== value.favorite)
          payload.favorite = value.favorite;
        if (snippet.labels.join(',') !== value.labels.join(','))
          payload.labels = value.labels;
        if (!Object.keys(payload).length) {
          close();
          return;
        }
      }
      const result = await tca(() => saveSnippet(payload, snippet?.id));
      if (!result.ok) {
        setFailure(errorMessage(result.error));
        return;
      }
      saved();
    },
  });
  const error = (field: 'title' | 'content' | 'labels') =>
    form.touched[field] && form.errors[field];
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      aria-labelledby="editor-title"
      onClose={form.isSubmitting ? undefined : close}
    >
      <DialogTitle id="editor-title">
        {snippet ? 'Snippet bearbeiten' : 'Neues Snippet'}
      </DialogTitle>
      <form noValidate onSubmit={form.handleSubmit}>
        <DialogContent dividers sx={{ maxHeight: '60dvh', overflowY: 'auto' }}>
          <Stack
            component="fieldset"
            disabled={form.isSubmitting}
            spacing={2.5}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
          >
            {!snippet && (
              <TextField
                select
                label="Vorlage"
                value={template}
                onChange={(event) => {
                  const choice = event.target.value;
                  setTemplate(choice);
                  const sample = templates[Number(choice)];
                  if (choice && sample)
                    void form.setValues({
                      ...sample,
                      labels: sample.labels.join(', '),
                    });
                  else void form.setValues(initialValues);
                }}
              >
                <MenuItem value="">Ohne Vorlage</MenuItem>
                {templates.map((sample, i) => (
                  <MenuItem key={sample.title} value={String(i)}>
                    {sample.title}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              autoFocus
              required
              label="Titel"
              {...form.getFieldProps('title')}
              error={Boolean(error('title'))}
              helperText={error('title')}
            />
            <TextField
              select
              label="Kategorie"
              {...form.getFieldProps('category')}
            >
              {categories.map((key) => (
                <MenuItem key={key} value={key}>
                  {categoryNames[key]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              multiline
              minRows={3}
              maxRows={10}
              required
              label="Code oder Befehl"
              {...form.getFieldProps('content')}
              error={Boolean(error('content'))}
              helperText={error('content')}
              sx={{ '& textarea': { fontFamily: 'monospace' } }}
            />
            <TextField
              label="Labels"
              {...form.getFieldProps('labels')}
              error={Boolean(error('labels'))}
              helperText={
                error('labels') ||
                'Mit Komma trennen, z. B. linux, powershell oder browser-konsole.'
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  name="favorite"
                  checked={form.values.favorite}
                  onChange={form.handleChange}
                />
              }
              label="Als Favorit markieren"
            />
            {failure && <Alert severity="error">{failure}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={form.isSubmitting}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={form.isSubmitting}
          >
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
