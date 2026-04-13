import { useEffect, useState } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { clearGuestSession } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    if (!token) {
      setError('Missing sign-in token. Please try “Continue with Google” again.');
      return;
    }
    localStorage.setItem('token', token);
    clearGuestSession();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    let cancelled = false;
    (async () => {
      try {
        await refresh();
        if (!cancelled) {
          navigate('/dashboard', { replace: true });
        }
      } catch {
        if (!cancelled) {
          setError('Could not load your account. Try logging in again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, refresh]);

  return (
    <Container className="py-5 text-center">
      {error ? (
        <p className="text-danger mb-0">{error}</p>
      ) : (
        <div className="d-flex flex-column align-items-center gap-3">
          <Spinner animation="border" />
          <p className="text-muted mb-0">Signing you in…</p>
        </div>
      )}
    </Container>
  );
}
