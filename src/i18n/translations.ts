import type { Language } from '../types/crypto';

export const TRANSLATIONS: Record<
  Language,
  {
    nav: {
      terminal: string;
      portfolio: string;
      backtest: string;
      exchanges: string;
      alerts: string;
      community: string;
      academy: string;
      security: string;
      support: string;
    };
    topbar: {
      paperMode: string;
      liveExchangeMode: string;
      newOrder: string;
      bankroll: string;
      riskProfile: string;
      themeDark: string;
      themeLight: string;
    };
    riskProfiles: {
      conservative: string;
      moderate: string;
      aggressive: string;
      institutional: string;
    };
    terminal: {
      marketOverview: string;
      chartTitle: string;
      candlesticks: string;
      line: string;
      area: string;
      indicators: string;
      aiPredictiveTitle: string;
      aiGenerateBtn: string;
      aiGenerating: string;
      aiConfidence: string;
      aiTarget24h: string;
      aiTarget7d: string;
      aiInvalidation: string;
      aiVolatility: string;
      aiRecommendation: string;
      orderTicketTitle: string;
      buy: string;
      sell: string;
      market: string;
      limit: string;
      stopLoss: string;
      takeProfit: string;
      amountUsd: string;
      quantity: string;
      executeOrder: string;
      resetBankroll: string;
      orderBook: string;
      bids: string;
      asks: string;
      spread: string;
      sourceLive: string;
      sourceSimulated: string;
    };
    portfolio: {
      title: string;
      totalEquity: string;
      unrealizedPnl: string;
      realizedPnl: string;
      winRate: string;
      equityCurve: string;
      openPositions: string;
      closePosition: string;
      ledgerTitle: string;
      exportCsv: string;
      exportExcel: string;
      exportPdf: string;
      noPositions: string;
    };
    backtest: {
      title: string;
      subtitle: string;
      asset: string;
      strategy: string;
      lookback: string;
      capital: string;
      fee: string;
      stopLossPct: string;
      takeProfitPct: string;
      runBacktest: string;
      running: string;
      totalReturn: string;
      buyHold: string;
      alpha: string;
      maxDrawdown: string;
      profitFactor: string;
      sharpe: string;
      tradesCount: string;
      strategyEquity: string;
      holdBenchmark: string;
    };
    exchanges: {
      title: string;
      connectTitle: string;
      automationTitle: string;
      addExchange: string;
      testLatency: string;
      createRule: string;
      triggerNow: string;
    };
    alerts: {
      title: string;
      volatilityRules: string;
      pushNotifications: string;
      enablePush: string;
      testPush: string;
      emailScheduler: string;
      sendPreview: string;
    };
    community: {
      title: string;
      publishStrategy: string;
      copyToSimulator: string;
    };
    academy: {
      title: string;
      interactiveLab: string;
    };
    security: {
      title: string;
      twoFactorTitle: string;
      setup2FA: string;
      verifyEnable: string;
      disable2FA: string;
      vaultTitle: string;
      auditLog: string;
    };
    support: {
      title: string;
      liveChatTitle: string;
      sendMessage: string;
      ticketTitle: string;
      submitTicket: string;
    };
  }
> = {
  pt: {
    nav: {
      terminal: 'Terminal & Gráficos',
      portfolio: 'Portfólio & P&L',
      backtest: 'Backtesting',
      exchanges: 'Exchanges & Automação',
      alerts: 'Alertas & Relatórios',
      community: 'Comunidade Social',
      academy: 'Tutoriais',
      security: 'Segurança 2FA',
      support: 'Suporte 24h',
    },
    topbar: {
      paperMode: 'Banca Simulada',
      liveExchangeMode: 'Corretora API',
      newOrder: 'Nova Ordem',
      bankroll: 'Banca Livre',
      riskProfile: 'Perfil de Risco',
      themeDark: 'Escuro',
      themeLight: 'Claro',
    },
    riskProfiles: {
      conservative: 'Conservador',
      moderate: 'Moderado',
      aggressive: 'Arrojado',
      institutional: 'Institucional',
    },
    terminal: {
      marketOverview: 'Cotações em Tempo Real',
      chartTitle: 'Gráfico Técnico Personalizável',
      candlesticks: 'Velas',
      line: 'Linha',
      area: 'Área',
      indicators: 'Indicadores',
      aiPredictiveTitle: 'Análise Preditiva por IA & Recomendações',
      aiGenerateBtn: 'Gerar Análise IA',
      aiGenerating: 'Analisando indicadores...',
      aiConfidence: 'Confiança',
      aiTarget24h: 'Faixa 24h',
      aiTarget7d: 'Alvo 7 dias',
      aiInvalidation: 'Invalidação',
      aiVolatility: 'Regime de Volatilidade',
      aiRecommendation: 'Recomendação Personalizada',
      orderTicketTitle: 'Simulador & Execução de Ordens',
      buy: 'Comprar',
      sell: 'Vender',
      market: 'Mercado',
      limit: 'Limite',
      stopLoss: 'Stop-Loss',
      takeProfit: 'Take-Profit',
      amountUsd: 'Valor (USDT)',
      quantity: 'Quantidade',
      executeOrder: 'Executar Ordem',
      resetBankroll: 'Gerenciar Banca',
      orderBook: 'Livro de Ofertas',
      bids: 'Compra',
      asks: 'Venda',
      spread: 'Spread',
      sourceLive: 'Feed API Real',
      sourceSimulated: 'Feed Quantitativo',
    },
    portfolio: {
      title: 'Gestão de Portfólio & Desempenho P&L',
      totalEquity: 'Patrimônio Total',
      unrealizedPnl: 'P&L Não Realizado',
      realizedPnl: 'P&L Realizado',
      winRate: 'Taxa de Acerto',
      equityCurve: 'Curva de Rendimento',
      openPositions: 'Posições Abertas',
      closePosition: 'Encerrar',
      ledgerTitle: 'Registro Instantâneo de Transações',
      exportCsv: 'Exportar CSV',
      exportExcel: 'Exportar Excel',
      exportPdf: 'Exportar PDF',
      noPositions: 'Nenhuma posição aberta no momento. Execute uma ordem no Terminal para iniciar.',
    },
    backtest: {
      title: 'Motor de Backtesting Histórico Multi-Ativos',
      subtitle: 'Valide estratégias quantitativas contra dados históricos antes de operar.',
      asset: 'Ativo',
      strategy: 'Estratégia',
      lookback: 'Período Histórico',
      capital: 'Capital Inicial ($)',
      fee: 'Taxa por Ordem (%)',
      stopLossPct: 'Stop-Loss (%)',
      takeProfitPct: 'Take-Profit (%)',
      runBacktest: 'Executar Backtest',
      running: 'Calculando...',
      totalReturn: 'Retorno Total',
      buyHold: 'Buy & Hold',
      alpha: 'Alpha vs Hold',
      maxDrawdown: 'Drawdown Máximo',
      profitFactor: 'Fator de Lucro',
      sharpe: 'Índice Sharpe',
      tradesCount: 'Operações',
      strategyEquity: 'Estratégia',
      holdBenchmark: 'Benchmark Hold',
    },
    exchanges: {
      title: 'Integração com Exchanges & Automação de Ordens',
      connectTitle: 'Cofre de APIs de Corretoras (AES-256-GCM)',
      automationTitle: 'Gatilhos Automatizados de Execução',
      addExchange: 'Conectar Corretora',
      testLatency: 'Testar Latência',
      createRule: 'Criar Gatilho Automático',
      triggerNow: 'Disparar Teste',
    },
    alerts: {
      title: 'Alertas de Volatilidade, Push & Relatórios por E-mail',
      volatilityRules: 'Monitoramento de Oscilações em Tempo Real',
      pushNotifications: 'Notificações Push no Navegador',
      enablePush: 'Ativar Push',
      testPush: 'Testar Notificação',
      emailScheduler: 'Entrega Automatizada por E-mail',
      sendPreview: 'Pré-visualizar & Enviar',
    },
    community: {
      title: 'Comunidade Social de Traders Experientes',
      publishStrategy: 'Publicar Estratégia',
      copyToSimulator: 'Copiar para Simulador',
    },
    academy: {
      title: 'Academia & Tutoriais Interativos para Iniciantes',
      interactiveLab: 'Laboratório Prático',
    },
    security: {
      title: 'Segurança Institucional: 2FA TOTP & Criptografia',
      twoFactorTitle: 'Autenticação de Dois Fatores (2FA TOTP)',
      setup2FA: 'Gerar QR Code 2FA',
      verifyEnable: 'Verificar e Ativar 2FA',
      disable2FA: 'Desativar 2FA',
      vaultTitle: 'Criptografia Ponta a Ponta & Proteção de Chaves',
      auditLog: 'Registro de Auditoria de Segurança',
    },
    support: {
      title: 'Central de Suporte 24 Horas',
      liveChatTitle: 'Chat ao Vivo 24h com Especialista',
      sendMessage: 'Enviar',
      ticketTitle: 'Abrir Chamado Prioritário',
      submitTicket: 'Registrar Chamado',
    },
  },
  en: {
    nav: {
      terminal: 'Terminal & Charts',
      portfolio: 'Portfolio & P&L',
      backtest: 'Backtesting',
      exchanges: 'Exchanges & Automation',
      alerts: 'Alerts & Reports',
      community: 'Social Community',
      academy: 'Tutorials',
      security: 'Security 2FA',
      support: '24/7 Support',
    },
    topbar: {
      paperMode: 'Paper Bankroll',
      liveExchangeMode: 'Exchange API',
      newOrder: 'New Order',
      bankroll: 'Free Cash',
      riskProfile: 'Risk Profile',
      themeDark: 'Dark',
      themeLight: 'Light',
    },
    riskProfiles: {
      conservative: 'Conservative',
      moderate: 'Moderate',
      aggressive: 'Aggressive',
      institutional: 'Institutional',
    },
    terminal: {
      marketOverview: 'Real-Time Quotes',
      chartTitle: 'Customizable Technical Chart',
      candlesticks: 'Candles',
      line: 'Line',
      area: 'Area',
      indicators: 'Indicators',
      aiPredictiveTitle: 'AI Predictive Analysis & Recommendations',
      aiGenerateBtn: 'Run AI Forecast',
      aiGenerating: 'Analyzing signals...',
      aiConfidence: 'Confidence',
      aiTarget24h: '24h Range',
      aiTarget7d: '7d Target',
      aiInvalidation: 'Invalidation',
      aiVolatility: 'Volatility Regime',
      aiRecommendation: 'Personalized Recommendation',
      orderTicketTitle: 'Risk-Free Simulator & Order Execution',
      buy: 'Buy',
      sell: 'Sell',
      market: 'Market',
      limit: 'Limit',
      stopLoss: 'Stop-Loss',
      takeProfit: 'Take-Profit',
      amountUsd: 'Amount (USDT)',
      quantity: 'Quantity',
      executeOrder: 'Execute Order',
      resetBankroll: 'Manage Bankroll',
      orderBook: 'Order Book',
      bids: 'Bids',
      asks: 'Asks',
      spread: 'Spread',
      sourceLive: 'Live API Feed',
      sourceSimulated: 'Quant Feed',
    },
    portfolio: {
      title: 'Portfolio Management & P&L Analytics',
      totalEquity: 'Total Equity',
      unrealizedPnl: 'Unrealized P&L',
      realizedPnl: 'Realized P&L',
      winRate: 'Win Rate',
      equityCurve: 'Performance Equity Curve',
      openPositions: 'Open Positions',
      closePosition: 'Close',
      ledgerTitle: 'Instant Transaction Ledger',
      exportCsv: 'Export CSV',
      exportExcel: 'Export Excel',
      exportPdf: 'Export PDF',
      noPositions: 'No open positions yet. Execute an order in the Terminal to start.',
    },
    backtest: {
      title: 'Multi-Asset Historical Backtesting Engine',
      subtitle: 'Validate quantitative strategies on historical price action before deploying.',
      asset: 'Asset',
      strategy: 'Strategy',
      lookback: 'Lookback Window',
      capital: 'Initial Capital ($)',
      fee: 'Order Fee (%)',
      stopLossPct: 'Stop-Loss (%)',
      takeProfitPct: 'Take-Profit (%)',
      runBacktest: 'Run Backtest',
      running: 'Computing...',
      totalReturn: 'Total Return',
      buyHold: 'Buy & Hold',
      alpha: 'Alpha vs Hold',
      maxDrawdown: 'Max Drawdown',
      profitFactor: 'Profit Factor',
      sharpe: 'Sharpe Ratio',
      tradesCount: 'Trades',
      strategyEquity: 'Strategy',
      holdBenchmark: 'Hold Benchmark',
    },
    exchanges: {
      title: 'Exchange Connectivity & Automated Execution',
      connectTitle: 'Encrypted Exchange API Vault (AES-256-GCM)',
      automationTitle: 'Automated Order Trigger Rules',
      addExchange: 'Connect Exchange',
      testLatency: 'Test Latency',
      createRule: 'Create Automated Trigger',
      triggerNow: 'Test Fire',
    },
    alerts: {
      title: 'Volatility Alerts, Push Notifications & Email Reports',
      volatilityRules: 'Real-Time Oscillation Monitors',
      pushNotifications: 'Browser Push Notifications',
      enablePush: 'Enable Push',
      testPush: 'Send Test Push',
      emailScheduler: 'Automated Email Delivery',
      sendPreview: 'Preview & Send',
    },
    community: {
      title: 'Social Strategy Community',
      publishStrategy: 'Publish Strategy',
      copyToSimulator: 'Copy to Simulator',
    },
    academy: {
      title: 'Interactive Trading Tutorials',
      interactiveLab: 'Interactive Lab',
    },
    security: {
      title: 'Institutional Security: 2FA TOTP & Encryption',
      twoFactorTitle: 'Two-Factor Authentication (2FA TOTP)',
      setup2FA: 'Generate 2FA QR Code',
      verifyEnable: 'Verify & Enable 2FA',
      disable2FA: 'Disable 2FA',
      vaultTitle: 'End-to-End Encryption & Key Isolation',
      auditLog: 'Security Audit Log',
    },
    support: {
      title: '24/7 Live Support Desk',
      liveChatTitle: '24/7 Live Specialist Chat',
      sendMessage: 'Send',
      ticketTitle: 'Submit Priority Ticket',
      submitTicket: 'Submit Ticket',
    },
  },
  es: {
    nav: {
      terminal: 'Terminal y Gráficos',
      portfolio: 'Portafolio y P&L',
      backtest: 'Backtesting',
      exchanges: 'Exchanges y Automatización',
      alerts: 'Alertas e Informes',
      community: 'Comunidad Social',
      academy: 'Tutoriales',
      security: 'Seguridad 2FA',
      support: 'Soporte 24h',
    },
    topbar: {
      paperMode: 'Banca Simulada',
      liveExchangeMode: 'Exchange API',
      newOrder: 'Nueva Orden',
      bankroll: 'Saldo Libre',
      riskProfile: 'Perfil de Riesgo',
      themeDark: 'Oscuro',
      themeLight: 'Claro',
    },
    riskProfiles: {
      conservative: 'Conservador',
      moderate: 'Moderado',
      aggressive: 'Arriesgado',
      institutional: 'Institucional',
    },
    terminal: {
      marketOverview: 'Cotizaciones en Tiempo Real',
      chartTitle: 'Gráfico Técnico Personalizable',
      candlesticks: 'Velas',
      line: 'Línea',
      area: 'Área',
      indicators: 'Indicadores',
      aiPredictiveTitle: 'Análisis Predictivo con IA y Recomendaciones',
      aiGenerateBtn: 'Generar Análisis IA',
      aiGenerating: 'Analizando señales...',
      aiConfidence: 'Confianza',
      aiTarget24h: 'Rango 24h',
      aiTarget7d: 'Objetivo 7d',
      aiInvalidation: 'Invalidación',
      aiVolatility: 'Régimen de Volatilidad',
      aiRecommendation: 'Recomendación Personalizada',
      orderTicketTitle: 'Simulador sin Riesgo y Ejecución',
      buy: 'Comprar',
      sell: 'Vender',
      market: 'Mercado',
      limit: 'Límite',
      stopLoss: 'Stop-Loss',
      takeProfit: 'Take-Profit',
      amountUsd: 'Monto (USDT)',
      quantity: 'Cantidad',
      executeOrder: 'Ejecutar Orden',
      resetBankroll: 'Gestionar Banca',
      orderBook: 'Libro de Órdenes',
      bids: 'Compra',
      asks: 'Venta',
      spread: 'Spread',
      sourceLive: 'Feed API Real',
      sourceSimulated: 'Feed Cuantitativo',
    },
    portfolio: {
      title: 'Gestión de Portafolio y Rendimiento P&L',
      totalEquity: 'Patrimonio Total',
      unrealizedPnl: 'P&L No Realizado',
      realizedPnl: 'P&L Realizado',
      winRate: 'Tasa de Acierto',
      equityCurve: 'Curva de Rendimiento',
      openPositions: 'Posiciones Abiertas',
      closePosition: 'Cerrar',
      ledgerTitle: 'Registro Instantáneo de Transacciones',
      exportCsv: 'Exportar CSV',
      exportExcel: 'Exportar Excel',
      exportPdf: 'Exportar PDF',
      noPositions: 'Sin posiciones abiertas. Ejecuta una orden en el Terminal.',
    },
    backtest: {
      title: 'Motor de Backtesting Histórico Multi-Activo',
      subtitle: 'Valida estrategias cuantitativas con datos históricos antes de operar.',
      asset: 'Activo',
      strategy: 'Estrategia',
      lookback: 'Período Histórico',
      capital: 'Capital Inicial ($)',
      fee: 'Comisión (%)',
      stopLossPct: 'Stop-Loss (%)',
      takeProfitPct: 'Take-Profit (%)',
      runBacktest: 'Ejecutar Backtest',
      running: 'Calculando...',
      totalReturn: 'Retorno Total',
      buyHold: 'Buy & Hold',
      alpha: 'Alpha vs Hold',
      maxDrawdown: 'Drawdown Máximo',
      profitFactor: 'Factor de Beneficio',
      sharpe: 'Ratio Sharpe',
      tradesCount: 'Operaciones',
      strategyEquity: 'Estrategia',
      holdBenchmark: 'Referencia Hold',
    },
    exchanges: {
      title: 'Conectividad con Exchanges y Automatización',
      connectTitle: 'Bóveda Cifrada de APIs (AES-256-GCM)',
      automationTitle: 'Reglas Automatizadas de Ejecución',
      addExchange: 'Conectar Exchange',
      testLatency: 'Probar Latencia',
      createRule: 'Crear Regla Automática',
      triggerNow: 'Probar Disparo',
    },
    alerts: {
      title: 'Alertas de Volatilidad, Push e Informes por Correo',
      volatilityRules: 'Monitoreo de Oscilaciones en Tiempo Real',
      pushNotifications: 'Notificaciones Push del Navegador',
      enablePush: 'Activar Push',
      testPush: 'Enviar Push de Prueba',
      emailScheduler: 'Entrega Automatizada por Correo',
      sendPreview: 'Vista Previa y Enviar',
    },
    community: {
      title: 'Comunidad Social de Traders',
      publishStrategy: 'Publicar Estrategia',
      copyToSimulator: 'Copiar al Simulador',
    },
    academy: {
      title: 'Academia y Tutoriales Interactivos',
      interactiveLab: 'Laboratorio Práctico',
    },
    security: {
      title: 'Seguridad Institucional: 2FA TOTP y Cifrado',
      twoFactorTitle: 'Autenticación de Dos Factores (2FA TOTP)',
      setup2FA: 'Generar QR 2FA',
      verifyEnable: 'Verificar y Activar 2FA',
      disable2FA: 'Desactivar 2FA',
      vaultTitle: 'Cifrado de Extremo a Extremo',
      auditLog: 'Registro de Auditoría',
    },
    support: {
      title: 'Centro de Soporte 24 Horas',
      liveChatTitle: 'Chat en Vivo 24h con Especialista',
      sendMessage: 'Enviar',
      ticketTitle: 'Abrir Ticket Prioritario',
      submitTicket: 'Enviar Ticket',
    },
  },
};
