import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import type {
  AutomationRule,
  Candle,
  CommunityPost,
  EmailReportSchedule,
  ExchangeConnection,
  ExecutionMode,
  Language,
  MarketTicker,
  NavSection,
  OrderBookData,
  PaperAccountState,
  RiskProfile,
  SecurityStatus,
  TechnicalSnapshot,
  ThemeMode,
  Timeframe,
  VolatilityAlert,
} from './types/crypto';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TerminalView } from './components/TerminalView';
import { PortfolioView } from './components/PortfolioView';
import { BacktestView } from './components/BacktestView';
import { ExchangesAutomationView } from './components/ExchangesAutomationView';
import { AlertsReportsView } from './components/AlertsReportsView';
import { CommunityView } from './components/CommunityView';
import { AcademyView } from './components/AcademyView';
import { SecurityView } from './components/SecurityView';
import { SupportView } from './components/SupportView';

interface ToastNotification {
  id: string;
  title: string;
  body: string;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('terminal');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('kq_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('kq_lang');
    return saved === 'en' || saved === 'es' ? saved : 'pt';
  });
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('moderate');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('paper');

  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');

  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candleSource, setCandleSource] = useState('binance');
  const [snapshot, setSnapshot] = useState<TechnicalSnapshot | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);

  const [paperAccount, setPaperAccount] = useState<PaperAccountState>({
    initialCapitalUsd: 100000,
    cashUsd: 100000,
    positions: [],
    trades: [],
    equityHistory: [],
  });
  const [exchanges, setExchanges] = useState<ExchangeConnection[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [volatilityAlerts, setVolatilityAlerts] = useState<VolatilityAlert[]>([]);
  const [emailSchedules, setEmailSchedules] = useState<EmailReportSchedule[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [security, setSecurity] = useState<SecurityStatus>({
    twoFactorEnabled: false,
    encryptionStandard: 'AES-256-GCM + TLS 1.3',
    require2FAForLiveOrders: true,
    auditLogs: [],
  });
  const [supportTickets, setSupportTickets] = useState<
    {
      id: string;
      subject: string;
      category: string;
      priority: string;
      message: string;
      status: string;
      createdAt: string;
    }[]
  >([]);

  const [prefilledOrder, setPrefilledOrder] = useState<{
    symbol?: string;
    side?: 'BUY' | 'SELL';
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    note?: string;
  } | null>(null);

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const orderInputRef = useRef<HTMLInputElement | null>(null);

  // Sync dark/light class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kq_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('kq_lang', language);
  }, [language]);

  const pushToast = useCallback((title: string, body: string, triggerNativePush = false) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ id, title, body }, ...prev].slice(0, 3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 6000);

    if (
      triggerNativePush &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, { body });
      } catch {
        // Ignore sandbox notification restrictions
      }
    }
  }, []);

  const refreshServerState = useCallback(async () => {
    try {
      const [stateResp, tickersResp] = await Promise.all([
        fetch('/api/state'),
        fetch('/api/market/tickers'),
      ]);
      if (stateResp.ok) {
        const s = await stateResp.json();
        setPaperAccount(s.paperAccount);
        setExchanges(s.exchanges);
        setAutomationRules(s.automationRules);
        setVolatilityAlerts(s.volatilityAlerts);
        setEmailSchedules(s.emailSchedules);
        setCommunityPosts(s.communityPosts);
        setSecurity(s.security);
        setSupportTickets(s.supportTickets ?? []);
      }
      if (tickersResp.ok) {
        const tk = await tickersResp.json();
        if (Array.isArray(tk.tickers)) setTickers(tk.tickers);
      }
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshServerState();
  }, [refreshServerState]);

  // Load candles and order book when symbol/timeframe changes
  useEffect(() => {
    let active = true;
    const loadMarketDetail = async () => {
      try {
        const [cResp, bResp] = await Promise.all([
          fetch(`/api/market/candles?symbol=${selectedSymbol}&interval=${timeframe}&limit=160`),
          fetch(`/api/market/orderbook?symbol=${selectedSymbol}`),
        ]);
        if (!active) return;
        if (cResp.ok) {
          const cData = await cResp.json();
          setCandles(cData.candles ?? []);
          setCandleSource(cData.source ?? 'simulated');
          setSnapshot(cData.snapshot ?? null);
        }
        if (bResp.ok) {
          const bData = await bResp.json();
          setOrderBook(bData);
        }
      } catch {
        // Retain prior view on transient network drop
      }
    };
    void loadMarketDetail();
    const refreshBookTimer = setInterval(async () => {
      try {
        const bResp = await fetch(`/api/market/orderbook?symbol=${selectedSymbol}`);
        if (active && bResp.ok) {
          setOrderBook(await bResp.json());
        }
      } catch {
        // Ignore
      }
    }, 6000);
    return () => {
      active = false;
      clearInterval(refreshBookTimer);
    };
  }, [selectedSymbol, timeframe]);

  // Real-time SSE live stream for tickers, alerts & automated orders
  useEffect(() => {
    const es = new EventSource('/api/market/stream');
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          tickers?: MarketTicker[];
          triggeredAlerts?: VolatilityAlert[];
          triggeredRules?: { rule: AutomationRule; orderId: string }[];
        };
        if (Array.isArray(data.tickers) && data.tickers.length > 0) {
          setTickers(data.tickers);
        }
        if (data.triggeredAlerts && data.triggeredAlerts.length > 0) {
          for (const al of data.triggeredAlerts) {
            pushToast(
              `Alerta de Volatilidade: ${al.symbol}`,
              al.lastMessage || 'Limiar atingido.',
              al.pushEnabled
            );
          }
          void refreshServerState();
        }
        if (data.triggeredRules && data.triggeredRules.length > 0) {
          for (const tr of data.triggeredRules) {
            pushToast(
              `Ordem Automática: ${tr.rule.symbol}`,
              `${tr.rule.actionSide} $${tr.rule.amountUsd} (${tr.rule.name})`,
              true
            );
          }
          void refreshServerState();
        }
      } catch {
        // Ignore malformed tick
      }
    };
    return () => {
      es.close();
    };
  }, [pushToast, refreshServerState]);

  const handlePlaceOrder = async (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
    mode: ExecutionMode;
    exchange: string;
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
    totpCode?: string;
    note?: string;
  }) => {
    try {
      const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { ok: false, error: data.error || 'Falha ao executar ordem.' };
      }
      setPaperAccount(data.paperAccount);
      void refreshServerState();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const handleResetBankroll = async (action: 'reset' | 'topup', amountUsd: number) => {
    const resp = await fetch('/api/paper/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, amountUsd }),
    });
    const data = await resp.json();
    if (resp.ok && data.paperAccount) {
      setPaperAccount(data.paperAccount);
      pushToast(
        'Banca Simulada Atualizada',
        `Saldo livre atual: $${data.paperAccount.cashUsd.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        })}`
      );
    }
  };

  const handleQuickOrderAction = () => {
    setActiveSection('terminal');
    setTimeout(() => {
      orderInputRef.current?.focus();
    }, 60);
  };

  const selectedTicker = tickers.find((x) => x.symbol === selectedSymbol) ?? tickers[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        language={language}
        onChangeLanguage={setLanguage}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        executionMode={executionMode}
        twoFactorEnabled={security.twoFactorEnabled}
        bankrollUsd={paperAccount.cashUsd}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          selectedTicker={selectedTicker}
          riskProfile={riskProfile}
          onChangeRiskProfile={setRiskProfile}
          language={language}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickOrderAction={handleQuickOrderAction}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {initialLoading && tickers.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
              <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800/70" />
              <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800/70" />
              <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800/70" />
            </div>
          ) : (
            <>
              {activeSection === 'terminal' && (
                <TerminalView
                  tickers={tickers}
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={setSelectedSymbol}
                  timeframe={timeframe}
                  onChangeTimeframe={setTimeframe}
                  candles={candles}
                  candleSource={candleSource}
                  snapshot={snapshot}
                  orderBook={orderBook}
                  theme={theme}
                  language={language}
                  riskProfile={riskProfile}
                  executionMode={executionMode}
                  onChangeExecutionMode={setExecutionMode}
                  exchanges={exchanges}
                  paperAccount={paperAccount}
                  twoFactorEnabled={security.twoFactorEnabled}
                  require2FAForLiveOrders={security.require2FAForLiveOrders}
                  prefilledOrder={prefilledOrder}
                  onClearPrefill={() => setPrefilledOrder(null)}
                  onPlaceOrder={handlePlaceOrder}
                  onResetBankroll={handleResetBankroll}
                  orderTicketInputRef={orderInputRef}
                />
              )}

              {activeSection === 'portfolio' && (
                <PortfolioView
                  paperAccount={paperAccount}
                  tickers={tickers}
                  language={language}
                  onClosePosition={async (symbol, quantity, currentPrice) => {
                    await handlePlaceOrder({
                      symbol,
                      side: 'SELL',
                      orderType: 'MARKET',
                      mode: 'paper',
                      exchange: 'KronoQuant Paper',
                      quantity,
                      price: currentPrice,
                      note: 'Encerramento direto via Portfólio',
                    });
                  }}
                />
              )}

              {activeSection === 'backtest' && (
                <BacktestView tickers={tickers} language={language} />
              )}

              {activeSection === 'exchanges' && (
                <ExchangesAutomationView
                  exchanges={exchanges}
                  automationRules={automationRules}
                  tickers={tickers}
                  language={language}
                  onAddExchange={async (payload) => {
                    const resp = await fetch('/api/exchanges', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error };
                    setExchanges(data.exchanges);
                    return { ok: true };
                  }}
                  onPingExchange={async (id) => {
                    const resp = await fetch(`/api/exchanges/${id}/ping`, { method: 'POST' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setExchanges(data.exchanges);
                    }
                  }}
                  onDeleteExchange={async (id) => {
                    const resp = await fetch(`/api/exchanges/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setExchanges(data.exchanges);
                    }
                  }}
                  onCreateRule={async (payload) => {
                    const resp = await fetch('/api/automation', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error };
                    setAutomationRules(data.automationRules);
                    return { ok: true };
                  }}
                  onToggleRule={async (id) => {
                    const resp = await fetch(`/api/automation/${id}/toggle`, { method: 'PATCH' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setAutomationRules(data.automationRules);
                    }
                  }}
                  onTestRule={async (id) => {
                    const resp = await fetch(`/api/automation/${id}/test`, { method: 'POST' });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error };
                    setAutomationRules(data.automationRules);
                    setPaperAccount(data.paperAccount);
                    return { ok: true };
                  }}
                  onDeleteRule={async (id) => {
                    const resp = await fetch(`/api/automation/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setAutomationRules(data.automationRules);
                    }
                  }}
                />
              )}

              {activeSection === 'alerts' && (
                <AlertsReportsView
                  alerts={volatilityAlerts}
                  emailSchedules={emailSchedules}
                  tickers={tickers}
                  language={language}
                  pushPermission={pushPermission}
                  onRequestPush={async () => {
                    if ('Notification' in window) {
                      const perm = await Notification.requestPermission();
                      setPushPermission(perm);
                    }
                  }}
                  onSendTestPush={() =>
                    pushToast(
                      'Alerta de Volatilidade KronoQuant',
                      `${selectedSymbol}/USDT oscilando em tempo real. Notificação Push verificada!`,
                      true
                    )
                  }
                  onCreateAlert={async (payload) => {
                    const resp = await fetch('/api/alerts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error };
                    setVolatilityAlerts(data.volatilityAlerts);
                    return { ok: true };
                  }}
                  onToggleAlert={async (id) => {
                    const resp = await fetch(`/api/alerts/${id}/toggle`, { method: 'PATCH' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setVolatilityAlerts(data.volatilityAlerts);
                    }
                  }}
                  onDeleteAlert={async (id) => {
                    const resp = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setVolatilityAlerts(data.volatilityAlerts);
                    }
                  }}
                  onCreateEmailSchedule={async (payload) => {
                    const resp = await fetch('/api/reports/schedule', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error };
                    setEmailSchedules(data.emailSchedules);
                    return { ok: true };
                  }}
                  onSendEmailPreview={async (id) => {
                    const resp = await fetch('/api/reports/send-preview', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id }),
                    });
                    const data = await resp.json();
                    if (resp.ok) {
                      setEmailSchedules(data.emailSchedules);
                      return data.digest;
                    }
                    return null;
                  }}
                  onDeleteEmailSchedule={async (id) => {
                    const resp = await fetch(`/api/reports/schedule/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                      const data = await resp.json();
                      setEmailSchedules(data.emailSchedules);
                    }
                  }}
                />
              )}

              {activeSection === 'community' && (
                <CommunityView
                  posts={communityPosts}
                  tickers={tickers}
                  language={language}
                  onLikePost={async (id) => {
                    const resp = await fetch(`/api/community/posts/${id}/like`, {
                      method: 'POST',
                    });
                    if (resp.ok) {
                      const data = await resp.json();
                      setCommunityPosts(data.communityPosts);
                    }
                  }}
                  onCopyStrategy={async (post) => {
                    const resp = await fetch(`/api/community/posts/${post.id}/copy`, {
                      method: 'POST',
                    });
                    if (resp.ok) {
                      const data = await resp.json();
                      setCommunityPosts(data.communityPosts);
                    }
                    setPrefilledOrder({
                      symbol: post.symbol,
                      side: post.direction === 'SHORT' ? 'SELL' : 'BUY',
                      price: post.entryPrice,
                      stopLoss: post.stopLossPrice,
                      takeProfit: post.targetPrice,
                      note: `Estratégia copiada de ${post.authorHandle}`,
                    });
                    setExecutionMode('paper');
                    setActiveSection('terminal');
                  }}
                  onPublishPost={async (payload) => {
                    const resp = await fetch('/api/community/posts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error };
                    setCommunityPosts(data.communityPosts);
                    return { ok: true };
                  }}
                />
              )}

              {activeSection === 'academy' && (
                <AcademyView
                  language={language}
                  onGoToSimulator={() => {
                    setExecutionMode('paper');
                    setActiveSection('terminal');
                  }}
                />
              )}

              {activeSection === 'security' && (
                <SecurityView
                  security={security}
                  language={language}
                  onRefreshSecurity={setSecurity}
                />
              )}

              {activeSection === 'support' && (
                <SupportView
                  language={language}
                  tickets={supportTickets}
                  onTicketCreated={setSupportTickets}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Live Toast Feed */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0"
          role="status"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-lg flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {toast.title}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {toast.body}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar notificação"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
