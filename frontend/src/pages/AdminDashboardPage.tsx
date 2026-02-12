import DownloadIcon from '@mui/icons-material/Download';
import LogoutIcon from '@mui/icons-material/Logout';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiFetch, downloadCsv } from '../api/client';
import type { AdminEvent, BulkCodeResponse, EventStatus } from '../types';

export function AdminDashboardPage() {
  const navigate = useNavigate();

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newStatus, setNewStatus] = useState<EventStatus>('draft');

  const [bulkEventId, setBulkEventId] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState(100);
  const [bulkOneTime, setBulkOneTime] = useState(true);
  const [bulkMaxUses, setBulkMaxUses] = useState(1);
  const [bulkExpiresAt, setBulkExpiresAt] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkCodeResponse | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const rows = await apiFetch<AdminEvent[]>('/api/admin/events');
      setEvents(rows);
      if (!bulkEventId && rows[0]) {
        setBulkEventId(rows[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErrorMessage('โหลดข้อมูล event ไม่สำเร็จ');
    }
  }, [bulkEventId, navigate]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const onCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiFetch('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle, status: newStatus }),
      });
      setNewTitle('');
      setNewStatus('draft');
      setSuccessMessage('สร้าง event สำเร็จ');
      await loadEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('สร้าง event ไม่สำเร็จ');
      }
    }
  };

  const onUpdateEvent = async (target: AdminEvent) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiFetch(`/api/admin/events/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: target.title,
          status: target.status,
          hlsPath: target.hlsPath,
        }),
      });
      setSuccessMessage(`อัปเดต ${target.title} สำเร็จ`);
      await loadEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('อัปเดต event ไม่สำเร็จ');
      }
    }
  };

  const onBulkGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = await apiFetch<BulkCodeResponse>('/api/admin/codes/bulk', {
        method: 'POST',
        body: JSON.stringify({
          eventId: bulkEventId,
          quantity: bulkQuantity,
          maxUses: bulkOneTime ? 1 : bulkMaxUses,
          oneTime: bulkOneTime,
          expiresAt: bulkExpiresAt ? new Date(bulkExpiresAt).toISOString() : undefined,
        }),
      });

      setBulkResult(payload);
      setSuccessMessage(`สร้างโค้ดสำเร็จ ${payload.created} รายการ`);
      await loadEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('สร้างโค้ดจำนวนมากไม่สำเร็จ');
      }
    }
  };

  const onDownloadCsv = async () => {
    if (!bulkEventId) {
      return;
    }

    try {
      await downloadCsv(`/api/admin/codes/export.csv?eventId=${bulkEventId}`, `codes-${bulkEventId}.csv`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('ดาวน์โหลด CSV ไม่สำเร็จ');
      }
    }
  };

  const onLogout = async () => {
    await apiFetch('/api/admin/auth/logout', { method: 'POST' });
    navigate('/admin/login');
  };

  const totals = useMemo(() => {
    return events.reduce(
      (acc, item) => {
        acc.codes += item.totalCodes;
        acc.redeems += item.redeemCount;
        acc.active += item.activeViewers;
        return acc;
      },
      { codes: 0, redeems: 0, active: 0 },
    );
  }, [events]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" fontWeight={700}>
            Admin Dashboard
          </Typography>
          <Button variant="outlined" startIcon={<LogoutIcon />} onClick={() => void onLogout()}>
            Logout
          </Button>
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle2">Total Codes</Typography>
              <Typography variant="h5">{totals.codes}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle2">Redeem Count</Typography>
              <Typography variant="h5">{totals.redeems}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle2">Active Viewers</Typography>
              <Typography variant="h5">{totals.active}</Typography>
            </CardContent>
          </Card>
        </Stack>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Create Event
            </Typography>
            <Stack component="form" direction={{ xs: 'column', md: 'row' }} spacing={2} onSubmit={onCreateEvent}>
              <TextField
                fullWidth
                label="Event title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as EventStatus)}>
                <MenuItem value="draft">draft</MenuItem>
                <MenuItem value="live">live</MenuItem>
                <MenuItem value="ended">ended</MenuItem>
              </Select>
              <Button type="submit" variant="contained">
                Create
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Event Management
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>HLS Path</TableCell>
                  <TableCell>Stream Key</TableCell>
                  <TableCell>Codes</TableCell>
                  <TableCell>Redeems</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((eventRow) => (
                  <TableRow key={eventRow.id}>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={eventRow.title}
                        onChange={(e) => {
                          setEvents((prev) =>
                            prev.map((item) =>
                              item.id === eventRow.id
                                ? {
                                    ...item,
                                    title: e.target.value,
                                  }
                                : item,
                            ),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={eventRow.status}
                        onChange={(e) => {
                          setEvents((prev) =>
                            prev.map((item) =>
                              item.id === eventRow.id
                                ? {
                                    ...item,
                                    status: e.target.value as EventStatus,
                                  }
                                : item,
                            ),
                          );
                        }}
                      >
                        <MenuItem value="draft">draft</MenuItem>
                        <MenuItem value="live">live</MenuItem>
                        <MenuItem value="ended">ended</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={eventRow.hlsPath ?? ''}
                        onChange={(e) => {
                          setEvents((prev) =>
                            prev.map((item) =>
                              item.id === eventRow.id
                                ? {
                                    ...item,
                                    hlsPath: e.target.value,
                                  }
                                : item,
                            ),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>{eventRow.streamKey}</TableCell>
                    <TableCell>{eventRow.totalCodes}</TableCell>
                    <TableCell>{eventRow.redeemCount}</TableCell>
                    <TableCell>{eventRow.activeViewers}</TableCell>
                    <TableCell align="right">
                      <Button variant="outlined" size="small" onClick={() => void onUpdateEvent(eventRow)}>
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Bulk Generate Codes
            </Typography>
            <Stack component="form" spacing={2} onSubmit={onBulkGenerate}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Select value={bulkEventId} onChange={(e) => setBulkEventId(e.target.value)}>
                  {events.map((eventRow) => (
                    <MenuItem key={eventRow.id} value={eventRow.id}>
                      {eventRow.title}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  type="number"
                  label="Quantity"
                  value={bulkQuantity}
                  inputProps={{ min: 1, max: 10000 }}
                  onChange={(e) => setBulkQuantity(Number(e.target.value))}
                />
                <TextField
                  type="number"
                  label="Max Uses"
                  value={bulkOneTime ? 1 : bulkMaxUses}
                  disabled={bulkOneTime}
                  onChange={(e) => setBulkMaxUses(Number(e.target.value))}
                />
                <TextField
                  type="datetime-local"
                  label="Expires At"
                  InputLabelProps={{ shrink: true }}
                  value={bulkExpiresAt}
                  onChange={(e) => setBulkExpiresAt(e.target.value)}
                />
                <FormControlLabel
                  control={<Switch checked={bulkOneTime} onChange={(e) => setBulkOneTime(e.target.checked)} />}
                  label="One-time"
                />
              </Stack>

              <Stack direction="row" spacing={2}>
                <Button type="submit" variant="contained">
                  Generate
                </Button>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void onDownloadCsv()}>
                  Download CSV
                </Button>
              </Stack>

              {bulkResult ? (
                <Box>
                  <Typography variant="subtitle2">Created: {bulkResult.created}</Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    value={bulkResult.codes.slice(0, 200).join('\n')}
                    helperText="แสดงตัวอย่างสูงสุด 200 โค้ดแรก"
                  />
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
