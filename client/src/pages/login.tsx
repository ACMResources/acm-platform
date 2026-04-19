import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('POST', '/api/auth/login', { username, password });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setLocation('/');
    } catch (err: any) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1c2b4a] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f5a623 0, #f5a623 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-[#f5a623] flex items-center justify-center mb-4 shadow-lg">
            <span className="text-xl font-black text-[#1c2b4a] tracking-widest">ACM</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ACM Resources</h1>
          <p className="text-white/50 text-sm mt-1">Staff Platform</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white">
          <CardHeader className="pb-2 pt-6 px-6">
            <div className="flex items-center gap-2 text-[#1c2b4a]">
              <Lock className="w-4 h-4 text-[#f5a623]" />
              <span className="font-semibold text-sm uppercase tracking-widest">Secure Login</span>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-[#1c2b4a] uppercase tracking-widest">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  className="border-gray-200 focus:border-[#1c2b4a] focus:ring-[#1c2b4a]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1c2b4a] uppercase tracking-widest">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="border-gray-200 focus:border-[#1c2b4a] focus:ring-[#1c2b4a]"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1c2b4a] hover:bg-[#1c2b4a]/90 text-white font-semibold mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in...</>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/30 text-xs mt-6">
          ACM Resources Pty Ltd · Perth, WA · Authorised Staff Only
        </p>
      </div>
    </div>
  );
}
