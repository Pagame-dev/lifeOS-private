import { useState, useEffect } from 'react';
import { Share, Plus, Bell, X, Smartphone } from 'lucide-react';
import { isIOS, isStandalone, isPushSupported } from '@/lib/push-manager';

interface InstallInstructionsProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export function InstallInstructions({ onDismiss, compact = false }: InstallInstructionsProps) {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const iosResult = isIOS();
    const standaloneResult = isStandalone();
    const supportedResult = isPushSupported();
    setIos(iosResult);
    setStandalone(standaloneResult);
    setSupported(supportedResult);

    const dismissed = localStorage.getItem('lifeos-install-dismissed') === 'true';
    if (!dismissed && iosResult && !standaloneResult) {
      setShow(true);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem('lifeos-install-dismissed', 'true');
    setShow(false);
    onDismiss?.();
  }

  if (!show && !compact) return null;
  if (standalone) return null;
  if (!ios && !compact) return null;

  const steps = [
    { icon: Share, text: 'Tap the Share button in Safari' },
    { icon: Plus, text: 'Choose "Add to Home Screen"' },
    { icon: Smartphone, text: 'Open Life OS from your Home Screen' },
    { icon: Bell, text: 'Enable notifications when prompted' },
  ];

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
            <Smartphone size={16} className="text-sage-300" />
          </div>
          <h3 className="font-display text-sm text-cream">Install Life OS</h3>
        </div>
        {onDismiss && (
          <button onClick={handleDismiss} className="text-cream-dim hover:text-cream transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <p className="text-xs text-cream-dim leading-relaxed">
        {ios
          ? 'Add Life OS to your Home Screen so it works like a native app and can send you push notifications even when closed.'
          : 'Install Life OS as a web app for a better experience and push notifications.'}
      </p>

      <div className="space-y-2.5">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                <Icon size={13} className="text-sage-300" />
              </div>
              <span className="text-xs text-cream-dim">{step.text}</span>
            </div>
          );
        })}
      </div>

      {!supported && (
        <p className="text-[11px] text-accent-warm/70">
          Push notifications require iOS 16.4+ and the app to be installed from the Home Screen.
        </p>
      )}
    </div>
  );
}

export function shouldShowInstallPrompt(): boolean {
  if (isStandalone()) return false;
  if (!isIOS()) return false;
  return localStorage.getItem('lifeos-install-dismissed') !== 'true';
}
