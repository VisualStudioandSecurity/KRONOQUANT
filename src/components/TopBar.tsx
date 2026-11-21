import React from 'react';
import { Menu } from 'lucide-react';
import type { Language, MarketTicker, NavSection, RiskProfile } from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface TopBarProps {
  activeSection: NavSection;
  selectedTicker?: MarketTicker;
  riskProfile: RiskProfile;
  onChangeRiskProfile: (profile: RiskProfile) => void;
  language: Language;
  onOpenMobileMenu: () => void;
  onQuickOrderAction: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  selectedTicker,
  riskProfile,
  onChangeRiskProfile,
  language,
  onOpenMobileMenu,
  onQuickOrderAction,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0E131F] px-4 lg:px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Mobile trigger + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu de navegação"
          className="p-2 -ml-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm truncate">
          <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
            Workspace
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
          <h1 className="font-semibold text-slate-900 dark:text-white truncate">
            {t.nav[activeSection]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Selected Asset Telemetry + Risk Profile Selector */}
      <div className="hidden md:flex items-center gap-6 text-xs whitespace-nowrap shrink-0">
        {selectedTicker && (
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-900 dark:text-white">
              {selectedTicker.symbol}/USDT
            </span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              ${selectedTicker.price.toLocaleString('en-US', {
                minimumFractionDigits: selectedTicker.price < 10 ? 4 : 2,
                maximumFractionDigits: selectedTicker.price < 10 ? 4 : 2,
              })}
            </span>
            <span
              className={`font-mono tabular-nums font-medium ${
                selectedTicker.change24h >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {selectedTicker.change24h >= 0 ? '+' : ''}
              {selectedTicker.change24h.toFixed(2)}%
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label
            htmlFor="global-risk-profile"
            className="text-slate-500 dark:text-slate-400 whitespace-nowrap"
          >
            {t.topbar.riskProfile}:
          </label>
          <select
            id="global-risk-profile"
            value={riskProfile}
            onChange={(e) => onChangeRiskProfile(e.target.value as RiskProfile)}
            className="bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="conservative">{t.riskProfiles.conservative}</option>
            <option value="moderate">{t.riskProfiles.moderate}</option>
            <option value="aggressive">{t.riskProfiles.aggressive}</option>
            <option value="institutional">{t.riskProfiles.institutional}</option>
          </select>
        </div>
      </div>

      {/* Zone 3: 1 Primary CTA */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onQuickOrderAction}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          {t.topbar.newOrder}
        </button>
      </div>
    </header>
  );
};
