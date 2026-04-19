import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard, Users, Building2, FolderOpen, Briefcase,
  Clock, FileText, ChevronRight, DollarSign, Megaphone, Inbox,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard',    url: '/',             icon: LayoutDashboard },
  { title: 'Candidates',   url: '/candidates',   icon: Users },
  { title: 'Clients',      url: '/clients',      icon: Building2 },
  { title: 'Projects',     url: '/projects',     icon: FolderOpen },
  { title: 'Placements',   url: '/placements',   icon: Briefcase },
  { title: 'Timesheets',   url: '/timesheets',   icon: Clock },
  { title: 'Quotes',       url: '/quotes',       icon: FileText },
  { title: 'Finance',      url: '/finance',      icon: DollarSign },
];

const recruitingItems = [
  { title: 'Job Ads',      url: '/job-ads',      icon: Megaphone },
  { title: 'Applications', url: '/applications', icon: Inbox },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      {/* Brand header */}
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[hsl(38,91%,54%)] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-[#1c2b4a] tracking-wider">ACM</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground leading-tight truncate">ACM Resources</p>
            <p className="text-xs text-sidebar-foreground/50 leading-tight">Admin Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Management */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest px-3 pt-4 pb-1">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== '/' && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="group" data-testid={`nav-${item.title.toLowerCase()}`}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recruiting */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest px-3 pt-4 pb-1">
            Recruiting
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recruitingItems.map((item) => {
                const isActive = location === item.url || location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="group" data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-[10px] text-sidebar-foreground/35 leading-relaxed">
          <p className="font-semibold text-sidebar-foreground/50 uppercase tracking-widest mb-0.5">ACM Resources</p>
          <p>Level 4, 432 Murray St, Perth</p>
          <p className="mt-1 text-[hsl(38,91%,54%)] font-semibold">Success Without Compromise</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
