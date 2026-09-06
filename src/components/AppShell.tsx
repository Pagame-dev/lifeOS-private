import { useState } from 'react';
import { Home, CalendarDays, CheckSquare, BarChart3, MoreHorizontal, Bell, Settings, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/views/Dashboard';
import { Schedule } from '@/views/Schedule';
import { Tasks } from '@/views/Tasks';
import { Statistics } from '@/views/Statistics';
import { More } from '@/views/More';
import { QuickAddModal } from '@/components/QuickAddModal';
import { AIChat, AIChatButton } from '@/components/AIChat';
import { NotificationPanel, NotificationToasts, useSmartNotifications } from '@/components/Notifications';

type View = 'home' | 'schedule' | 'tasks' | 'statistics' | 'more';

const navItems: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

export function AppShell() {
  const { profile } = useAuth();
  const [view, setView] = useState<View>('home');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useSmartNotifications();

  return (
    <div className="min-h-screen bg-charcoal-950 flex flex-col">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-white/[0.04] bg-charcoal-900/40 backdrop-blur-sm z-40">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
              <span className="font-display text-xl text-sage-300">L</span>
            </div>
            <div>
              <h1 className="font-display text-lg text-cream leading-none">Life OS</h1>
              <p className="text-[10px] text-cream-dim mt-0.5">Personal Operating System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-sage-500/10 text-sage-200 border border-sage-500/15'
                    : 'text-cream-dim hover:text-cream hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.04]">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
          >
            <Plus size={16} />
            Quick Add
          </button>
          <div className="mt-3 px-2">
            <p className="text-xs text-cream-dim truncate">
              {profile?.display_name || 'User'}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-charcoal-950/80 backdrop-blur-lg border-b border-white/[0.04]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
              <span className="font-display text-base text-sage-300">L</span>
            </div>
            <span className="font-display text-base text-cream">Life OS</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setNotifOpen(true)} className="relative p-2 text-cream-dim hover:text-cream transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sage-400" />
              )}
            </button>
            <button onClick={() => setView('more')} className="p-2 text-cream-dim hover:text-cream transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop notification button */}
      <button
        onClick={() => setNotifOpen(true)}
        className="hidden md:flex fixed top-4 right-4 z-40 w-10 h-10 rounded-lg border border-white/[0.06] bg-charcoal-900/40 backdrop-blur-sm items-center justify-center text-cream-dim hover:text-cream hover:bg-white/[0.03] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sage-500/20 border border-sage-500/30 flex items-center justify-center">
            <span className="text-[8px] font-mono text-sage-300">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-16 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-fade-in">
          {view === 'home' && <Dashboard onNavigate={setView} />}
          {view === 'schedule' && <Schedule />}
          {view === 'tasks' && <Tasks />}
          {view === 'statistics' && <Statistics />}
          {view === 'more' && <More />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-charcoal-950/90 backdrop-blur-lg border-t border-white/[0.06]">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                  active ? 'text-sage-300' : 'text-cream-dim'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile FAB */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-sage-500/20 border border-sage-500/30 flex items-center justify-center text-sage-200 shadow-lg shadow-sage-500/10 active:scale-95 transition-transform"
      >
        <Plus size={22} />
      </button>

      {/* AI Chat floating button */}
      <AIChatButton onClick={() => setChatOpen(true)} />

      {/* Toast notification banners */}
      <NotificationToasts />

      {/* Modals & overlays */}
      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}
      {chatOpen && <AIChat open={chatOpen} onClose={() => setChatOpen(false)} />}
      {notifOpen && <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />}
    </div>
  );
}
