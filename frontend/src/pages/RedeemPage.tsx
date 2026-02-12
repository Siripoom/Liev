import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import type { RedeemResponse } from '../types';

export function RedeemPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const infoMessage = useMemo(() => {
    const search = new URLSearchParams(location.search);
    if (search.get('reason') === 'session_terminated') {
      return 'Session เดิมถูกตัดหรือหมดอายุ กรุณาใส่โค้ดใหม่';
    }
    return null;
  }, [location.search]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const payload = await apiFetch<RedeemResponse>('/api/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      navigate(`/watch/${payload.eventId}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message || error.code);
      } else {
        setErrorMessage('ไม่สามารถยืนยันโค้ดได้');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', py: 4 }}>
      <Card sx={{ width: '100%' }}>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={onSubmit}>
            <Typography variant="h5" fontWeight={700}>
              Live Access
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ใส่ Access Code 8 ตัวอักษร (A-Z, 0-9)
            </Typography>
            {infoMessage ? <Alert severity="info">{infoMessage}</Alert> : null}
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            <TextField
              label="Access Code"
              value={code}
              inputProps={{ maxLength: 8 }}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AB12CD34"
              required
            />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Redeem & Watch'}
            </Button>
            <Box>
              <Typography variant="caption" color="text.secondary">
                สำหรับผู้ดูแลระบบ: <a href="/admin/login">Admin Login</a>
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
