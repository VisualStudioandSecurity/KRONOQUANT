import React, { useState } from 'react';
import { Copy, Heart, Plus } from 'lucide-react';
import type { CommunityPost, Language, MarketTicker, RiskProfile, Timeframe } from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface CommunityViewProps {
  posts: CommunityPost[];
  tickers: MarketTicker[];
  language: Language;
  onLikePost: (id: string) => Promise<void>;
  onCopyStrategy: (post: CommunityPost) => Promise<void>;
  onPublishPost: (payload: {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    timeframe: Timeframe;
    entryPrice: number;
    targetPrice: number;
    stopLossPrice: number;
    thesis: string;
    riskTier: RiskProfile;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  posts,
  tickers,
  language,
  onLikePost,
  onCopyStrategy,
  onPublishPost,
}) => {
  const t = TRANSLATIONS[language];
  const [showComposer, setShowComposer] = useState(false);
  const [symbol, setSymbol] = useState('BTC');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [entryPrice, setEntryPrice] = useState('91200');
  const [targetPrice, setTargetPrice] = useState('96500');
  const [stopLossPrice, setStopLossPrice] = useState('88400');
  const [riskTier, setRiskTier] = useState<RiskProfile>('moderate');
  const [thesis, setThesis] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await onPublishPost({
      symbol,
      direction,
      timeframe,
      entryPrice: Number(entryPrice),
      targetPrice: Number(targetPrice),
      stopLossPrice: Number(stopLossPrice),
      thesis,
      riskTier,
    });
    if (res.ok) {
      setThesis('');
      setShowComposer(false);
    } else {
      setError(res.error || 'Erro ao publicar estratégia.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.community.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Analise setups validados por traders experientes e copie os parâmetros direto para sua banca simulada.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowComposer((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.community.publishStrategy}</span>
        </button>
      </div>

      {showComposer && (
        <form
          onSubmit={handlePublish}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4"
        >
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div>
              <label htmlFor="com-sym" className="block text-xs text-slate-500 mb-1">
                Ativo
              </label>
              <select
                id="com-sym"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {tickers.map((tk) => (
                  <option key={tk.symbol} value={tk.symbol}>
                    {tk.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="com-dir" className="block text-xs text-slate-500 mb-1">
                Direção
              </label>
              <select
                id="com-dir"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'LONG' | 'SHORT')}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>

            <div>
              <label htmlFor="com-tf" className="block text-xs text-slate-500 mb-1">
                Timeframe
              </label>
              <select
                id="com-tf"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>
            </div>

            <div>
              <label htmlFor="com-entry" className="block text-xs text-slate-500 mb-1">
                Entrada ($)
              </label>
              <input
                id="com-entry"
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="com-tp" className="block text-xs text-slate-500 mb-1">
                Alvo ($)
              </label>
              <input
                id="com-tp"
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="com-sl" className="block text-xs text-slate-500 mb-1">
                Stop ($)
              </label>
              <input
                id="com-sl"
                type="number"
                step="any"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
            <div>
              <label htmlFor="com-risk" className="block text-xs text-slate-500 mb-1">
                Perfil Recomendado
              </label>
              <select
                id="com-risk"
                value={riskTier}
                onChange={(e) => setRiskTier(e.target.value as RiskProfile)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="conservative">{t.riskProfiles.conservative}</option>
                <option value="moderate">{t.riskProfiles.moderate}</option>
                <option value="aggressive">{t.riskProfiles.aggressive}</option>
                <option value="institutional">{t.riskProfiles.institutional}</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="com-thesis" className="block text-xs text-slate-500 mb-1">
                Tese Técnica e Gestão de Risco
              </label>
              <textarea
                id="com-thesis"
                rows={2}
                placeholder="Descreva os gatilhos técnicos, volume e racional do trade..."
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {error && <div className="text-xs text-rose-500">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Publicar Setup
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={post.avatarUrl}
                  alt={post.authorName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {post.authorName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {post.authorRole} · Acerto {post.winRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {post.symbol}/USDT ·{' '}
                  <span
                    className={
                      post.direction === 'LONG'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {post.direction}
                  </span>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {post.timeframe} · {t.riskProfiles[post.riskTier]}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800/80 text-xs font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Entrada</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    ${post.entryPrice.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Alvo</div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ${post.targetPrice.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Stop</div>
                  <div className="font-semibold text-rose-600 dark:text-rose-400">
                    ${post.stopLossPrice.toLocaleString()}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {post.thesis}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => onLikePost(post.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  post.likedByMe
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{post.likes}</span>
              </button>

              <button
                type="button"
                onClick={() => onCopyStrategy(post)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t.community.copyToSimulator} ({post.copies})</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
