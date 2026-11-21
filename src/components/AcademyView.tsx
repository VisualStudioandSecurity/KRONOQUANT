import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Language } from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface AcademyViewProps {
  language: Language;
  onGoToSimulator: () => void;
}

const MODULES = [
  {
    id: 'm1',
    title: '01. Leitura de Candlesticks, Suporte e Resistência',
    duration: '5 min',
    level: 'Iniciante',
    summary:
      'Entenda como abertura, máxima, mínima e fechamento revelam pressão compradora e zonas onde o preço tende a reagir.',
    steps: [
      'Corpo verde indica fechamento acima da abertura; corpo vermelho indica domínio vendedor.',
      'Sombras longas na parte inferior sinalizam rejeição de queda e defesa de suporte.',
      'No Terminal KronoQuant, combine Candlesticks com SMA20 para confirmar tendência.',
    ],
    quizQuestion: 'O que um pavio inferior longo próximo a um suporte costuma indicar?',
    quizOptions: [
      'Rejeição de preços mais baixos e entrada de compradores',
      'Garantia de queda imediata de 50%',
      'Erro na corretora',
    ],
    correctIndex: 0,
  },
  {
    id: 'm2',
    title: '02. RSI (14), Bandas de Bollinger e Volatilidade ATR',
    duration: '7 min',
    level: 'Essencial',
    summary:
      'Use osciladores de momento e bandas estatísticas para evitar compras em topo e identificar compressões explosivas.',
    steps: [
      'RSI acima de 70 sugere sobrecompra; abaixo de 30 indica sobrevenda estatística.',
      'Bandas de Bollinger estreitas sinalizam baixa volatilidade precedendo rompimentos direcionais.',
      'O ATR(14) mede a amplitude média recente para calibrar a distância ideal do Stop-Loss.',
    ],
    quizQuestion: 'Qual valor de RSI(14) normalmente caracteriza zona de sobrevenda?',
    quizOptions: ['Acima de 80', 'Abaixo de 30', 'Exatamente 50'],
    correctIndex: 1,
  },
  {
    id: 'm3',
    title: '03. Gestão de Risco e Dimensionamento de Posição',
    duration: '6 min',
    level: 'Fundamental',
    summary:
      'Aprenda a calcular o tamanho exato da ordem para nunca arriscar mais do que 1% a 2% da banca em uma única operação.',
    steps: [
      'Defina o Stop-Loss antes de entrar no trade, nunca depois.',
      'Use a fórmula: Risco Máximo ($) ÷ Distância do Stop (%) = Tamanho da Posição.',
      'Pratique primeiro na Banca Simulada sem risco antes de conectar dinheiro real.',
    ],
    quizQuestion: 'Qual é o risco máximo recomendado por operação para preservação de capital?',
    quizOptions: ['1% a 2% do patrimônio', '50% do patrimônio', '100% sem stop'],
    correctIndex: 0,
  },
];

export const AcademyView: React.FC<AcademyViewProps> = ({ language, onGoToSimulator }) => {
  const t = TRANSLATIONS[language];
  const [activeId, setActiveId] = useState('m1');
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  // Interactive position sizing lab state
  const [labBankroll, setLabBankroll] = useState(10000);
  const [labRiskPct, setLabRiskPct] = useState(1.5);
  const [labStopPct, setLabStopPct] = useState(5);

  const activeModule = MODULES.find((m) => m.id === activeId) ?? MODULES[0];

  const maxLossUsd = (labBankroll * labRiskPct) / 100;
  const recommendedPositionUsd = labStopPct > 0 ? maxLossUsd / (labStopPct / 100) : 0;

  const handleAnswer = (modId: string, optionIdx: number, correctIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [modId]: optionIdx }));
    if (optionIdx === correctIdx && !completedIds.includes(modId)) {
      setCompletedIds((prev) => [...prev, modId]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.academy.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Progresso: {completedIds.length} de {MODULES.length} módulos concluídos
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToSimulator}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
        >
          Praticar no Simulador
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module Selector */}
        <div className="lg:col-span-4 space-y-3">
          {MODULES.map((m) => {
            const done = completedIds.includes(m.id);
            const active = m.id === activeId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-500/8 dark:bg-blue-500/12'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {m.title}
                  </div>
                  {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {m.level} · {m.duration}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Lesson & Quiz */}
        <div className="lg:col-span-8 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {activeModule.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeModule.summary}
            </p>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              {activeModule.steps.map((s, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {idx + 1}.
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Verificação Rápida: {activeModule.quizQuestion}
              </div>
              <div className="space-y-2">
                {activeModule.quizOptions.map((opt, idx) => {
                  const chosen = selectedAnswers[activeModule.id];
                  const isSelected = chosen === idx;
                  const isCorrect = idx === activeModule.correctIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswer(activeModule.id, idx, activeModule.correctIndex)}
                      className={`w-full text-left px-3.5 py-2.5 text-xs rounded-lg border transition-colors ${
                        isSelected
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Interactive Position Sizing Lab */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.academy.interactiveLab}: Calculadora de Risco & Tamanho de Posição
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="lab-bankroll" className="block text-xs text-slate-500 mb-1">
                  Banca Total ($): <strong className="font-mono">${labBankroll}</strong>
                </label>
                <input
                  id="lab-bankroll"
                  type="range"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={labBankroll}
                  onChange={(e) => setLabBankroll(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="lab-risk" className="block text-xs text-slate-500 mb-1">
                  Risco por Trade (%): <strong className="font-mono">{labRiskPct}%</strong>
                </label>
                <input
                  id="lab-risk"
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={labRiskPct}
                  onChange={(e) => setLabRiskPct(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="lab-stop" className="block text-xs text-slate-500 mb-1">
                  Distância do Stop (%): <strong className="font-mono">{labStopPct}%</strong>
                </label>
                <input
                  id="lab-stop"
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={labStopPct}
                  onChange={(e) => setLabStopPct(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500">Perda Máxima Permitida</div>
                <div className="text-lg font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                  -${maxLossUsd.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Tamanho Ideal da Ordem</div>
                <div className="text-lg font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  ${Math.min(labBankroll, recommendedPositionUsd).toFixed(2)}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
