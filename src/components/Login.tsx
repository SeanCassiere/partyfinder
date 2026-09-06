import { useId, useState } from 'react';
import { api } from '../lib/api';
import { Logo } from './Logo';
import { ThemePicker } from './ThemePicker';
import type { Connection } from '../lib/types';

export function Login({
  connection,
  onConnect,
}: {
  connection: Connection | null;
  onConnect: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const guestId = `${fieldId}-guest`;
  const host = connection?.server || 'your Copyparty server';

  async function connect(guest: boolean) {
    setBusy(true);
    setError('');
    try {
      await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({ password: guest ? '' : password }),
      });
      setPassword('');
      onConnect();
    } catch (failure) {
      setError((failure as Error).message);
    }
    setBusy(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!password) {
      setError('Enter your Copyparty password, or continue as a guest.');
      document.getElementById(fieldId)?.focus();
      return;
    }
    void connect(false);
  }

  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemePicker />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <Logo />
        </div>
        <h1>Sign in</h1>
        <p className="login-host">
          Connect to <strong>{host}</strong>
        </p>

        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor={fieldId}>Password</label>
          <input
            id={fieldId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p className="error-box" id={errorId} role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="primary login-submit"
            aria-disabled={busy || undefined}
            data-busy={busy || undefined}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="login-guest">
            <button
              type="button"
              className="secondary"
              onClick={() => void connect(true)}
              aria-disabled={busy || undefined}
              data-busy={busy || undefined}
              aria-describedby={guestId}
            >
              Continue as guest
            </button>
            <p id={guestId}>
              Guest access signs in without a password and shows only the folders your server
              publishes to anonymous visitors.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
