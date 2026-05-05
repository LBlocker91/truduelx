import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ResetPassword = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // Supabase puts type=recovery in the URL hash on reset link
    const hash = window.location.hash;
    setRecovery(hash.includes('type=recovery'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password updated. Redirecting…');
    setTimeout(() => navigate('/'), 800);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={submit} className="game-card rounded-xl p-6 w-full max-w-sm space-y-4">
        <h1 className="font-orbitron text-xl text-glow-cyan">Set a new password</h1>
        {!recovery && (
          <p className="text-xs text-muted-foreground">
            Open this page from the link in your password reset email.
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <Button type="submit" disabled={busy} className="w-full btn-neon text-primary-foreground">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
        </Button>
      </form>
    </main>
  );
};

export default ResetPassword;
