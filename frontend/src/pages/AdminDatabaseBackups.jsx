import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) {
    return '—';
  }
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

export default function AdminDatabaseBackups() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [runFeedback, setRunFeedback] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);

  const loadList = useCallback(async () => {
    setError(null);
    const res = await api.get('/admin/database-backups');
    setPayload(res.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadList();
      } catch (e) {
        if (!cancelled) {
          setPayload(null);
          setError(e?.response?.data?.message || 'Could not load backups.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  async function downloadBackup(key) {
    setDownloadError(null);
    setDownloadingKey(key);
    try {
      const res = await api.get('/admin/database-backups/download-url', { params: { key } });
      const url = res.data?.url;
      if (!url) {
        setDownloadError('No download URL returned.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setDownloadError(e?.response?.data?.message || 'Could not create download link.');
    } finally {
      setDownloadingKey(null);
    }
  }

  async function runBackup() {
    setRunning(true);
    setRunFeedback(null);
    try {
      const res = await api.post('/admin/database-backups/run');
      setRunFeedback({
        variant: 'success',
        title: res.data?.message || 'Backup completed.',
        output: res.data?.output || '',
      });
      await loadList();
    } catch (e) {
      const d = e?.response?.data;
      setRunFeedback({
        variant: 'danger',
        title: d?.message || 'Backup failed.',
        output: typeof d?.output === 'string' ? d.output : '',
      });
    } finally {
      setRunning(false);
    }
  }

  if (loading && !payload) {
    return (
      <div className="text-center py-5">
        <Spinner />
      </div>
    );
  }

  const rows = payload?.backups ?? [];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-cloud-arrow-up text-br-rose" aria-hidden />
          Database backups
        </h1>
        <Button variant="primary" disabled={running} onClick={() => runBackup()}>
          {running ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" aria-hidden />
              Running backup…
            </>
          ) : (
            <>
              <i className="bi bi-play-fill me-1" aria-hidden />
              Run backup now
            </>
          )}
        </Button>
      </div>
      <p className="text-muted small mb-3">
        Runs <code className="small">php artisan bandready:backup</code> on the server (local folder under{' '}
        <code className="small">storage/app/backups</code>, then zip to R2 when configured). Only the newest{' '}
        <strong>{payload?.max_files ?? 10}</strong> remote archives are kept.
      </p>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {downloadError ? (
        <Alert variant="danger" dismissible onClose={() => setDownloadError(null)}>
          {downloadError}
        </Alert>
      ) : null}

      {runFeedback ? (
        <Alert variant={runFeedback.variant} className="small">
          <div className="fw-semibold mb-1">{runFeedback.title}</div>
          {runFeedback.output ? (
            <pre className="mb-0 mt-2 small text-body-secondary bg-body-tertiary p-2 rounded overflow-auto">
              {runFeedback.output}
            </pre>
          ) : null}
        </Alert>
      ) : null}

      {payload && !payload.configured ? (
        <Alert variant="warning" className="mb-0">
          <div className="fw-semibold mb-1">R2 is not configured</div>
          <p className="small mb-2">
            Set <code>R2_BUCKET</code>, <code>R2_ENDPOINT</code>, <code>R2_ACCESS_KEY_ID</code>, and{' '}
            <code>R2_SECRET_ACCESS_KEY</code> in the API <code>.env</code> (see <code>config/filesystems.php</code>{' '}
            disk <code>{payload.disk}</code>). Optional: <code>BANDREADY_DATABASE_BACKUP_R2_PREFIX</code> (default{' '}
            <code>{payload.prefix}</code>).
          </p>
        </Alert>
      ) : payload?.configured ? (
        rows.length === 0 ? (
          <p className="text-muted mb-0">No backup archives in this bucket prefix yet.</p>
        ) : (
          <div className="table-responsive br-card">
            <Table hover size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>File</th>
                  <th className="text-end">Size</th>
                  <th>Uploaded</th>
                  <th className="text-end">Download</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <code className="small text-break">{row.name}</code>
                    </td>
                    <td className="text-end text-nowrap small">{formatBytes(row.size)}</td>
                    <td className="text-nowrap small text-muted">
                      {row.last_modified ? new Date(row.last_modified).toLocaleString() : '—'}
                    </td>
                    <td className="text-end text-nowrap">
                      <Button
                        type="button"
                        variant="outline-primary"
                        size="sm"
                        disabled={downloadingKey === row.key}
                        onClick={() => downloadBackup(row.key)}
                      >
                        {downloadingKey === row.key ? (
                          <Spinner animation="border" size="sm" className="align-middle" aria-hidden />
                        ) : (
                          <>
                            <i className="bi bi-download me-1" aria-hidden />
                            Download
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )
      ) : null}
    </div>
  );
}
