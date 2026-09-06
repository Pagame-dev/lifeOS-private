import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email, password, displayName);
      if (signUpError) setError(signUpError);
    } else {
      const { error: signInError } = await signIn(email, password);
      if (signInError) setError(signInError);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sage-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-warm/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sage-500/10 border border-sage-500/20 mb-4">
            <span className="font-display text-2xl text-sage-300">L</span>
          </div>
          <h1 className="font-display text-3xl text-cream mb-1">Life OS</h1>
          <p className="text-sm text-cream-dim">
            Your personal operating system
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="flex gap-1 mb-6 p-1 bg-charcoal-900/50 rounded-lg">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-charcoal-700 text-cream'
                  : 'text-cream-dim hover:text-cream'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-charcoal-700 text-cream'
                  : 'text-cream-dim hover:text-cream'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-cream-dim mb-1.5 font-medium">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-cream-dim mb-1.5 font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-cream-dim mb-1.5 font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-cream-dim/60 mt-6">
          Your data is private and secure. Only you can see it.
        </p>
      </div>
    </div>
  );
}
