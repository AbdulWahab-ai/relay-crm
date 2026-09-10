'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { Layers, ArrowRight, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DEMO } from '@/lib/demo-store';
export function AuthForm({ mode }: { mode: 'login' | 'signup' | 'invite' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setToken(q.get('token') || '');
    if (q.get('error'))
      setError(
        q.get('error') === 'AccountNotLinked'
          ? 'This email has an existing password account. Sign in with your password; Google is not automatically linked.'
          : 'Unable to sign in. Please try again.',
      );
    if (!DEMO)
      fetch('/api/auth/providers')
        .then((r) => r.json())
        .then((p) => setGoogle(!!p.google))
        .catch(() => {});
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        const r = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, organizationName }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
      }
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error)
        throw Error('Invalid email or password, or too many sign-in attempts.');
      location.href = token
        ? '/invite?token=' + encodeURIComponent(token)
        : '/';
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="auth-bg">
      <section className="auth-card">
        <Link
          href="/"
          className="text-[27px] font-semibold tracking-[-1px] flex gap-2 items-center mb-9"
        >
          <Layers className="bg-primary rounded-lg p-1.5 w-9 h-9 text-white" />
          relay<span className="text-primary">.</span>
        </Link>
        <h1 className="text-2xl font-semibold">
          {mode === 'signup'
            ? 'Your next chapter starts here.'
            : mode === 'invite'
              ? 'Join your team’s workspace.'
              : 'Welcome back.'}
        </h1>
        <p className="subtitle mb-7">
          {mode === 'signup'
            ? 'Create your account and first organization.'
            : mode === 'invite'
              ? 'Accept your invitation with the email address that was invited.'
              : 'Keep your relationships moving forward.'}
        </p>
        {DEMO ? (
          <div>
            <div className="ai-gradient p-4 text-sm text-[#8b779f] rounded-lg leading-loose">
              This is the sample-data demo. Account signup, OAuth and
              invitations become available when the production services are
              connected.
            </div>
            <Link
              href="/"
              className="flex items-center justify-center bg-primary text-white p-3 rounded-lg mt-6 text-sm"
            >
              Open demo workspace <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>
        ) : mode === 'invite' ? (
          <InviteAcceptance token={token} />
        ) : (
          <>
            <form className="space-y-4" onSubmit={submit}>
              {mode === 'signup' && (
                <>
                  <label className="field">
                    Full name
                    <Input
                      autoComplete="name"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Organization name
                    <Input
                      required
                      minLength={2}
                      value={organizationName}
                      onChange={(e) => setOrg(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="field">
                Email address
                <Input
                  autoComplete="email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Password
                <Input
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  required
                  type="password"
                  minLength={mode === 'signup' ? 12 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'signup' && (
                  <span className="text-xs muted font-normal">
                    At least 12 characters.
                  </span>
                )}
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <Button
                disabled={busy}
                type="submit"
                className="w-full h-11 mt-2"
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : mode === 'signup' ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
                <ArrowRight size={16} />
              </Button>
            </form>
            {google && (
              <Button
                variant="outline"
                className="w-full h-11 mt-3"
                onClick={() => signIn('google', { callbackUrl: '/' })}
              >
                Continue with Google
              </Button>
            )}
            <p className="text-sm muted text-center mt-6">
              {mode === 'signup' ? 'Already have an account?' : 'New to Relay?'}{' '}
              <Link
                className="text-primary"
                href={mode === 'signup' ? '/login' : '/signup'}
              >
                {mode === 'signup' ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
function InviteAcceptance({ token }: { token: string }) {
  const { status } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (status === 'loading') return <LoaderCircle className="animate-spin" />;
  if (status !== 'authenticated')
    return (
      <div className="text-sm muted leading-loose">
        Sign in first, then reopen this invitation link.
        <Link
          href={'/login?token=' + encodeURIComponent(token)}
          className="block text-primary mt-4"
        >
          Sign in to accept →
        </Link>
        <Link href="/signup" className="block text-primary mt-2">
          Create an account →
        </Link>
      </div>
    );
  return (
    <div>
      {error && <p className="form-error mb-4">{error}</p>}
      <Button
        disabled={busy || !token}
        className="w-full h-11"
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch('/api/invitations/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            });
            const j = await r.json();
            if (!r.ok) throw Error(j.error);
            location.href = '/';
          } catch (e: any) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        Accept invitation
      </Button>
    </div>
  );
}
