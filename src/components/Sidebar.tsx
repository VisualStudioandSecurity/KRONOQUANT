import React from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Briefcase,
  Cpu,
  FlaskConical,
  Headphones,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type { ExecutionMode, Language, NavSection, ThemeMode } from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  executionMode: ExecutionMode;
  twoFactorEnabled: boolean;
  bankrollUsd: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  language,
  onChangeLanguage,
  theme,
  onToggleTheme,
  executionMode,
  twoFactorEnabled,
  bankrollUsd,
  mobileOpen,
  onCloseMobile,
}) => {
  const t = TRANSLATIONS[language];

  const navItems: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'terminal', label: t.nav.terminal, icon: Activity },
    { id: 'portfolio', label: t.nav.portfolio, icon: Briefcase },
    { id: 'backtest', label: t.nav.backtest, icon: FlaskConical },
    { id: 'exchanges', label: t.nav.exchanges, icon: Cpu },
    { id: 'alerts', label: t.nav.alerts, icon: Bell },
    { id: 'community', label: t.nav.community, icon: Users },
    { id: 'academy', label: t.nav.academy, icon: BookOpen },
    { id: 'security', label: t.nav.security, icon: ShieldCheck },
    { id: 'support', label: t.nav.support, icon: Headphones },
  ];

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0E131F] flex flex-col transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('terminal')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            KronoQuant
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap text-left focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  active
                    ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>{executionMode === 'paper' ? t.topbar.paperMode : t.topbar.liveExchangeMode}</span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                ${bankrollUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>2FA TOTP</span>
              <span
                className={
                  twoFactorEnabled
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'text-amber-600 dark:text-amber-400 font-medium'
                }
              >
                {twoFactorEnabled ? 'Ativo' : 'Pendente'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80">
              {(['pt', 'en', 'es'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onChangeLanguage(lang)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors uppercase whitespace-nowrap ${
                    language === lang
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? t.topbar.themeLight : t.topbar.themeDark}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? t.topbar.themeLight : t.topbar.themeDark}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
