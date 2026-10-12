import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Sparkles } from 'lucide-react';
import { getThemeColors } from '../../utils/theme';

export const AnnouncementBar: React.FC = () => {
  const { settings } = useStore();
  const themeColors = getThemeColors(settings.theme, settings.themeMode);

  if (!settings.announcement?.enabled || !settings.announcement?.text?.trim()) {
    return null;
  }

  return (
    <div className={`${themeColors.announcementBg} ${themeColors.announcementText} border-b border-amber-600/30 text-xs py-2 px-4 relative z-40 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
        <span className="font-medium tracking-wide">
          {settings.announcement.text}
        </span>
      </div>
    </div>
  );
};
