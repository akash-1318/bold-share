import React, { useState } from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';

const supabase = createSupabaseBrowserClient();

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = '/file-sharing';
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage('Check your email to confirm your account.');
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage('Check your email for a login link.');
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  };

  return (
    <div className="max-w-md mx-auto p-8 space-y-6 bg-white neo-brutal">
      <div className="flex gap-4 font-black uppercase text-sm">
        <button onClick={() => setMode('password')} className={mode === 'password' ? 'underline' : 'opacity-50'}>
          Password
        </button>
        <button onClick={() => setMode('magic-link')} className={mode === 'magic-link' ? 'underline' : 'opacity-50'}>
          Magic Link
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-2 border-black p-3 font-bold"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-black p-3 font-bold"
          />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-black text-white px-6 py-3 neo-brutal font-black uppercase flex-1">
              Log In
            </button>
            <button type="button" onClick={handleSignUp} disabled={loading} className="bg-[#00F0FF] px-6 py-3 neo-brutal font-black uppercase flex-1">
              Sign Up
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-2 border-black p-3 font-bold"
          />
          <button type="submit" disabled={loading} className="w-full bg-black text-white px-6 py-3 neo-brutal font-black uppercase">
            Send Magic Link
          </button>
        </form>
      )}

      <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-black px-6 py-3 neo-brutal font-black uppercase">
        Sign in with Google
      </button>

      {message && <p className="font-bold text-green-700">{message}</p>}
      {error && <p className="font-bold text-red-500">{error}</p>}
    </div>
  );
};

export default LoginForm;
