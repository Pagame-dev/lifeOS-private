import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/components/AuthPage';
import { AppShell } from '@/components/AppShell';
import { OnboardingWizard } from '@/components/OnboardingWizard';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-sage-500/10 border border-sage-500/20 flex items-center justify-center animate-pulse">
          <span className="font-display text-xl text-sage-300">L</span>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (profile && !profile.onboarding_completed) return <OnboardingWizard />;
  return <AppShell />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
