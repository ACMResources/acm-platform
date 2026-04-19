import { Switch, Route, Router, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import Dashboard from '@/pages/dashboard';
import CandidatesPage from '@/pages/candidates';
import ClientsPage from '@/pages/clients';
import ProjectsPage from '@/pages/projects';
import ProjectDetailPage from '@/pages/project-detail';
import PlacementsPage from '@/pages/placements';
import TimesheetsPage from '@/pages/timesheets';
import QuotesPage from '@/pages/quotes';
import FinancePage from '@/pages/finance';
import CandidateDetailPage from '@/pages/candidate-detail';
import JobAdsPage from '@/pages/job-ads';
import ApplicationsPage from '@/pages/applications';
import JobsPage from '@/pages/jobs';
import LoginPage from '@/pages/login';
import NotFound from '@/pages/not-found';

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark(d => !d)} data-testid="button-theme-toggle">
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

function AuthenticatedApp() {
  async function handleLogout() {
    await apiRequest('POST', '/api/auth/logout');
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
  }

  return (
    <SidebarProvider style={{ '--sidebar-width': '16rem', '--sidebar-width-icon': '3.5rem' } as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ACM Platform</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/candidates" component={CandidatesPage} />
                <Route path="/candidates/:id" component={CandidateDetailPage} />
                <Route path="/clients" component={ClientsPage} />
                <Route path="/projects" component={ProjectsPage} />
                <Route path="/projects/:id" component={ProjectDetailPage} />
                <Route path="/placements" component={PlacementsPage} />
                <Route path="/timesheets" component={TimesheetsPage} />
                <Route path="/quotes" component={QuotesPage} />
                <Route path="/finance" component={FinancePage} />
                <Route path="/job-ads" component={JobAdsPage} />
                <Route path="/applications" component={ApplicationsPage} />
                <Route component={NotFound} />
              </Switch>
            </Router>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppShell() {
  const { data: auth, isLoading } = useQuery<{ authenticated: boolean } | null>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) return { authenticated: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Public job wall — always accessible, no auth check
  const path = window.location.pathname;
  if (path === '/jobs' || path.startsWith('/jobs/')) {
    return (
      <Router>
        <Switch>
          <Route path="/jobs" component={JobsPage} />
          <Route path="/jobs/:id" component={JobsPage} />
        </Switch>
      </Router>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1c2b4a] flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-[#f5a623] flex items-center justify-center animate-pulse">
          <span className="text-[10px] font-black text-[#1c2b4a]">ACM</span>
        </div>
      </div>
    );
  }

  if (!auth?.authenticated) {
    return (
      <Router>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route component={LoginPage} />
        </Switch>
      </Router>
    );
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppShell />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
