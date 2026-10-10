import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-900/95 border border-amber-500/40 px-3.5 py-2 text-xs font-medium text-amber-100 shadow-xl backdrop-blur-xs">
      <WifiOff className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
      <span>Offline Mode — Viewing saved local boutique catalog</span>
    </div>
  );
};
