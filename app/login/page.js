'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "That didn't work. Check the details and try again.");
        setLoading(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="mb-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-husk">
            Ruchi Vana
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-parchment">
            The Ledger
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
              Username
            </label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-bark bg-canopy px-4 py-3 text-parchment outline-none focus:border-harvest focus:ring-1 focus:ring-harvest"
              required
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-bark bg-canopy px-4 py-3 text-parchment outline-none focus:border-harvest focus:ring-1 focus:ring-harvest"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rust/15 px-3 py-2 text-sm text-rust">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-harvest py-3 font-medium text-soil transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
