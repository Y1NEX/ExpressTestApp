import { Box, Stack, Typography } from '@mui/material';
import TerminalRounded from '@mui/icons-material/TerminalRounded';

export function Brand() {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.main',
          color: 'white',
          width: 38,
          height: 38,
          borderRadius: '11px',
        }}
      >
        <TerminalRounded fontSize="small" />
      </Box>
      <Typography
        component="span"
        sx={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.04em' }}
      >
        SnippetShelf
      </Typography>
    </Stack>
  );
}
