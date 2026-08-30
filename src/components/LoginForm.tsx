import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';

const supabase = createSupabaseBrowserClient();

interface Props {
  initialError?: string | null;
}

const LoginForm = ({ initialError }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [passwordAction, setPasswordAction] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [loading, setLoading] = useState(false);

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

  const switchMode = (nextMode: 'password' | 'magic-link') => {
    setMode(nextMode);
    setPasswordAction('login');
    setError(null);
    setMessage(null);
  };

  const switchPasswordAction = (nextAction: 'login' | 'signup') => {
    setPasswordAction(nextAction);
    setError(null);
    setMessage(null);
  };

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // Email confirmation is disabled for this project, so signUp already
      // returned an active session — no confirmation email is sent, and
      // none is needed.
      window.location.href = '/file-sharing';
      return;
    }
    setMessage(`Check your email at ${email} to confirm your account.`);
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
        <button onClick={() => switchMode('password')} className={mode === 'password' ? 'underline' : 'opacity-50'}>
          Password
        </button>
        <button onClick={() => switchMode('magic-link')} className={mode === 'magic-link' ? 'underline' : 'opacity-50'}>
          Magic Link
        </button>
      </div>

      {mode === 'password' ? (
        passwordAction === 'login' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-black p-3 font-bold"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-black p-3 pr-12 font-bold"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white px-6 py-3 neo-brutal font-black uppercase">
              Log In
            </button>
            <button type="button" onClick={() => switchPasswordAction('signup')} className="w-full text-center font-bold text-sm underline">
              Don't have an account? Sign Up
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <input
              type="text"
              required
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border-2 border-black p-3 font-bold"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-black p-3 font-bold"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-black p-3 pr-12 font-bold"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border-2 border-black p-3 pr-12 font-bold"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#00F0FF] px-6 py-3 neo-brutal font-black uppercase">
              Create Account
            </button>
            <button type="button" onClick={() => switchPasswordAction('login')} className="w-full text-center font-bold text-sm underline">
              Already have an account? Log In
            </button>
          </form>
        )
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

      {/*
      <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-black px-6 py-3 neo-brutal font-black uppercase">
        Sign in with Google
      </button>
      */}

      {message && <p className="font-bold text-green-700">{message}</p>}
      {error && <p className="font-bold text-red-500">{error}</p>}
    </div>
  );
};

export default LoginForm;
