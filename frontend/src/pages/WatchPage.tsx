import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { HlsPlayer } from '../components/HlsPlayer';
import type { StreamResponse } from '../types';

const HEARTBEAT_MS = 20000;

export function WatchPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamResponse | null>(null);

  const loadStream = useCallback(async () => {
    if (!eventId) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiFetch<StreamResponse>(`/api/stream-url?eventId=${eventId}`);
      setStream(data);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'SESSION_TERMINATED') {
          navigate('/?reason=session_terminated');
          return;
        }
        setErrorMessage(error.message || error.code);
      } else {
        setErrorMessage('ไม่สามารถโหลดสตรีมได้');
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  useEffect(() => {
    void loadStream();
  }, [loadStream]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        await apiFetch('/api/heartbeat', {
          method: 'POST',
          body: JSON.stringify({ eventId }),
        });
      } catch (error) {
        if (error instanceof ApiError && error.code === 'SESSION_TERMINATED') {
          navigate('/?reason=session_terminated');
        }
      }
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [eventId, navigate]);

  const statusBanner = useMemo(() => {
    if (!stream) {
      return null;
    }

    if (stream.eventStatus === 'not_started') {
      return <Alert severity="info">Live ยังไม่เริ่ม</Alert>;
    }

    if (stream.eventStatus === 'ended') {
      return <Alert severity="warning">Live จบแล้ว</Alert>;
    }

    return null;
  }, [stream]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" fontWeight={700}>
          Live Event
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : null}

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {statusBanner}

        {!loading && stream?.eventStatus === 'live' && stream.playbackUrl ? <HlsPlayer src={stream.playbackUrl} /> : null}

        <Box>
          <Button variant="outlined" onClick={() => void loadStream()}>
            Refresh Stream
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
