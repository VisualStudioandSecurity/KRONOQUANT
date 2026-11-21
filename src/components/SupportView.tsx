import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { Language, SupportMessage } from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface SupportViewProps {
  language: Language;
  tickets: {
    id: string;
    subject: string;
    category: string;
    priority: string;
    message: string;
    status: string;
    createdAt: string;
  }[];
  onTicketCreated: (tickets: SupportViewProps['tickets']) => void;
}

export const SupportView: React.FC<SupportViewProps> = ({
  language,
  tickets,
  onTicketCreated,
}) => {
  const t = TRANSLATIONS[language];
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Olá! Sou o especialista de suporte 24h da KronoQuant. Como posso ajudar com gráficos, backtesting, APIs de corretoras ou 2FA?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  // Ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Integração API');
  const [priority, setPriority] = useState('Alta');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketFeedback, setTicketFeedback] = useState<string | null>(null);

  const sendChatMessage = async (textToSend?: string) => {
    const text = (textToSend ?? chatInput).trim();
    if (!text) return;
    if (!textToSend) setChatInput('');

    const userMsg: SupportMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const resp = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language }),
      });
      const data = await resp.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'agent',
          text: resp.ok
            ? data.reply
            : data.error || 'Não foi possível conectar ao especialista agora.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: 'Erro de rede ao enviar mensagem para o suporte.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketFeedback(null);
    const resp = await fetch('/api/support/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, category, priority, message: ticketMessage }),
    });
    const data = await resp.json();
    if (resp.ok) {
      onTicketCreated(data.supportTickets);
      setSubject('');
      setTicketMessage('');
      setTicketFeedback(`Chamado ${data.ticket.id} registrado com atendimento prioritário.`);
    } else {
      setTicketFeedback(data.error || 'Erro ao abrir chamado.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Live Chat 24h */}
      <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] flex flex-col h-[560px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.support.liveChatTitle}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Atendimento contínuo 24/7 · Resposta em segundos
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="text-xs text-slate-400">Especialista digitando...</div>
          )}
        </div>

        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800/70">
          {[
            'Como configurar 2FA TOTP?',
            'Como funciona a Banca Simulada?',
            'Como exportar relatório em PDF e Excel?',
          ].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendChatMessage(q)}
              className="px-2.5 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendChatMessage();
          }}
          className="p-4 flex gap-2"
        >
          <input
            type="text"
            aria-label="Mensagem para o suporte 24h"
            placeholder="Digite sua dúvida para o suporte..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t.support.sendMessage}</span>
          </button>
        </form>
      </section>

      {/* Priority Ticket Desk */}
      <section className="lg:col-span-5 space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.support.ticketTitle}
          </h2>

          <form onSubmit={handleSubmitTicket} className="space-y-3">
            <div>
              <label htmlFor="tkt-sub" className="block text-xs text-slate-500 mb-1">
                Assunto
              </label>
              <input
                id="tkt-sub"
                type="text"
                placeholder="Ex: Dúvida na sincronização Binance Spot"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tkt-cat" className="block text-xs text-slate-500 mb-1">
                  Categoria
                </label>
                <select
                  id="tkt-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="Integração API">Integração API</option>
                  <option value="Segurança & 2FA">Segurança & 2FA</option>
                  <option value="Backtesting & IA">Backtesting & IA</option>
                  <option value="Relatórios">Relatórios</option>
                </select>
              </div>
              <div>
                <label htmlFor="tkt-pri" className="block text-xs text-slate-500 mb-1">
                  Prioridade
                </label>
                <select
                  id="tkt-pri"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tkt-msg" className="block text-xs text-slate-500 mb-1">
                Descrição
              </label>
              <textarea
                id="tkt-msg"
                rows={3}
                placeholder="Descreva o contexto da solicitação..."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            {ticketFeedback && (
              <div className="text-xs text-blue-600 dark:text-blue-400">{ticketFeedback}</div>
            )}

            <button
              type="submit"
              className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:opacity-90"
            >
              {t.support.submitTicket}
            </button>
          </form>
        </div>

        {tickets.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              Chamados Recentes
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {tickets.map((tk) => (
                <div key={tk.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {tk.id} · {tk.subject}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {tk.category} · {tk.priority}
                    </div>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {tk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
