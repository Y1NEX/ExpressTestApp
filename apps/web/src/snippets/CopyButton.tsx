import { useState } from 'react';
import { Box, Button } from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import { tca } from '@itsezz/try-catch';

export function CopyButton({ content }: { content: string }) {
  const [copyMessage, setCopyMessage] = useState('');
  async function copy() {
    const result = await tca(async () =>
      navigator.clipboard.writeText(content),
    );
    setCopyMessage(
      result.ok
        ? 'Kopiert'
        : 'Kopieren fehlgeschlagen. Bitte markiere den Code und kopiere ihn manuell.',
    );
  }
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ContentCopyRounded />}
        onClick={() => void copy()}
      >
        Kopieren
      </Button>
      <Box role="status" sx={{ fontSize: 14, '&:empty': { display: 'none' } }}>
        {copyMessage}
      </Box>
    </>
  );
}
