import { Box, Stack, Typography } from '@mui/material';

export function Brand() {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <Box
        component="img"
        src="/favicon.svg"
        alt=""
        width={40}
        height={40}
        sx={{ display: 'block', flexShrink: 0 }}
      />
      <Typography
        component="span"
        sx={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.04em' }}
      >
        SnippetShelf
      </Typography>
    </Stack>
  );
}
