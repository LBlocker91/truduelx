import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Swords, Zap, Mail, KeyRound, UserCircle2, Ghost } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

export const AuthScreen = () => {
  const { signIn, signUp, signInWithGoogle, signInAsGuest, sendPasswordReset } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Welcome back');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signUp(email.trim(), password, displayName.trim() || undefined);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Account created. Check your email to verify, then sign in.');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await sendPasswordReset(email.trim());
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Reset email sent if the address exists');
  };

  const handleGoogle = async () => {
    setBusy(true);
    const res = await signInWithGoogle();
    if (res.error) {
      setBusy(false);
      toast.error('Google sign-in failed');
    }
  };

  const handleGuest = async () => {
    setBusy(true);
    const { error } = await signInAsGuest();
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Signed in as guest');
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4"
      style={{ backgroundImage: `url(${battleArenaBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/90" />
      <div className="absolute inset-0 starfield opacity-50" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-primary animate-pulse-glow" />
            <Swords className="w-10 h-10 text-secondary animate-float" />
            <Zap className="w-8 h-8 text-primary animate-pulse-glow" />
          </div>
          <h1 className="font-orbitron text-4xl font-black tracking-wider">
            <span className="text-primary text-glow-cyan">RIFTBOUND</span>{' '}
            <span className="text-secondary text-glow-orange">DUEL</span>
          </h1>
          <p className="text-muted-foreground text-sm font-rajdhani mt-1">Sign in to enter the Rift</p>
        </div>

        <div className="game-card rounded-xl p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="forgot">Forgot</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3 mt-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <Field id="si-email" label="Email" icon={<Mail className="w-4 h-4" />}>
                  <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Field id="si-pw" label="Password" icon={<KeyRound className="w-4 h-4" />}>
                  <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </Field>
                <Button type="submit" disabled={busy} className="w-full btn-neon text-primary-foreground">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 mt-4">
              <form onSubmit={handleSignUp} className="space-y-3">
                <Field id="su-name" label="Display Name" icon={<UserCircle2 className="w-4 h-4" />}>
                  <Input id="su-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Pilot-7" maxLength={24} />
                </Field>
                <Field id="su-email" label="Email" icon={<Mail className="w-4 h-4" />}>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Field id="su-pw" label="Password" icon={<KeyRound className="w-4 h-4" />}>
                  <Input id="su-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </Field>
                <Button type="submit" disabled={busy} className="w-full btn-fire text-secondary-foreground">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="forgot" className="space-y-3 mt-4">
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Enter your email and we'll send a password reset link.
                </p>
                <Field id="fp-email" label="Email" icon={<Mail className="w-4 h-4" />}>
                  <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Button type="submit" disabled={busy} variant="outline" className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-card px-2 text-muted-foreground font-orbitron">Or</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleGoogle} disabled={busy} variant="outline" className="w-full">
              <GoogleIcon /> Continue with Google
            </Button>
            <Button onClick={handleGuest} disabled={busy} variant="ghost" className="w-full text-muted-foreground">
              <Ghost className="w-4 h-4 mr-2" /> Continue as Guest
            </Button>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4 font-orbitron tracking-wider">
          v1.0.0 ALPHA
        </p>
      </div>
    </div>
  );
};

const Field = ({
  id, label, icon, children,
}: { id: string; label: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-orbitron text-muted-foreground">
      {icon} {label}
    </Label>
    {children}
  </div>
);

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.55c2.08-1.92 3.29-4.74 3.29-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.76c-.98.66-2.24 1.05-3.73 1.05-2.87 0-5.3-1.94-6.17-4.55H2.18v2.85A11 11 0 0 0 12 23z" fill="#34A853"/>
    <path d="M5.83 14.08A6.6 6.6 0 0 1 5.47 12c0-.72.13-1.42.36-2.08V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.65-2.85z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.65 2.85C6.7 7.32 9.13 5.38 12 5.38z" fill="#EA4335"/>
  </svg>
);
