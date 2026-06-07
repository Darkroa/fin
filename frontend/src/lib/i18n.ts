export type LangCode = 'en-US' | 'en-GB' | 'fr' | 'es' | 'de' | 'ar' | 'zh' | 'pt'

export const translations: Record<string, Record<LangCode, string>> = {
  // ── Bottom nav ──────────────────────────────────────
  'nav.home':     { 'en-US': 'Home',     'en-GB': 'Home',     'fr': 'Accueil',  'es': 'Inicio',    'de': 'Start',    'ar': 'الرئيسية', 'zh': '主页',  'pt': 'Início' },
  'nav.trade':    { 'en-US': 'Trade',    'en-GB': 'Trade',    'fr': 'Trader',   'es': 'Operar',    'de': 'Handel',   'ar': 'تداول',    'zh': '交易',  'pt': 'Negociar' },
  'nav.finbot':   { 'en-US': 'Fin Bot',  'en-GB': 'Fin Bot',  'fr': 'Fin Bot',  'es': 'Fin Bot',   'de': 'Fin Bot',  'ar': 'فن بوت',   'zh': 'Fin机器人', 'pt': 'Fin Bot' },
  'nav.markets':  { 'en-US': 'Markets',  'en-GB': 'Markets',  'fr': 'Marchés',  'es': 'Mercados',  'de': 'Märkte',   'ar': 'الأسواق',  'zh': '市场',  'pt': 'Mercados' },
  'nav.profile':  { 'en-US': 'Profile',  'en-GB': 'Profile',  'fr': 'Profil',   'es': 'Perfil',    'de': 'Profil',   'ar': 'الملف',    'zh': '我的',  'pt': 'Perfil' },

  // ── Sidebar nav ─────────────────────────────────────
  'nav.dashboard':      { 'en-US': 'Dashboard',      'en-GB': 'Dashboard',      'fr': 'Tableau de bord', 'es': 'Panel',        'de': 'Übersicht',    'ar': 'لوحة التحكم',  'zh': '仪表板',  'pt': 'Painel' },
  'nav.wallet':         { 'en-US': 'Wallet',          'en-GB': 'Wallet',          'fr': 'Portefeuille',    'es': 'Billetera',    'de': 'Wallet',       'ar': 'المحفظة',      'zh': '钱包',    'pt': 'Carteira' },
  'nav.chatfin':        { 'en-US': 'Chat Fin',        'en-GB': 'Chat Fin',        'fr': 'Chat Fin',        'es': 'Chat Fin',     'de': 'Chat Fin',     'ar': 'شات فين',      'zh': 'Chat Fin', 'pt': 'Chat Fin' },
  'nav.news':           { 'en-US': 'News',             'en-GB': 'News',             'fr': 'Actualités',      'es': 'Noticias',     'de': 'Nachrichten',  'ar': 'الأخبار',      'zh': '新闻',    'pt': 'Notícias' },
  'nav.notifications':  { 'en-US': 'Notifications',   'en-GB': 'Notifications',   'fr': 'Notifications',   'es': 'Notificaciones','de': 'Benachrichtigungen', 'ar': 'الإشعارات', 'zh': '通知', 'pt': 'Notificações' },
  'nav.settings':       { 'en-US': 'Settings',        'en-GB': 'Settings',        'fr': 'Paramètres',      'es': 'Configuración', 'de': 'Einstellungen', 'ar': 'الإعدادات',   'zh': '设置',    'pt': 'Configurações' },
  'nav.support':        { 'en-US': 'Support',         'en-GB': 'Support',         'fr': 'Assistance',      'es': 'Soporte',       'de': 'Support',      'ar': 'الدعم',        'zh': '支持',    'pt': 'Suporte' },
  'nav.pricing':        { 'en-US': 'Pricing',         'en-GB': 'Pricing',         'fr': 'Tarifs',          'es': 'Precios',       'de': 'Preise',       'ar': 'الأسعار',      'zh': '价格',    'pt': 'Preços' },
  'nav.ads':            { 'en-US': 'Ads',             'en-GB': 'Ads',             'fr': 'Annonces',        'es': 'Anuncios',      'de': 'Anzeigen',     'ar': 'الإعلانات',    'zh': '广告',    'pt': 'Anúncios' },
  'nav.store':          { 'en-US': 'Store',           'en-GB': 'Store',           'fr': 'Boutique',        'es': 'Tienda',        'de': 'Shop',         'ar': 'المتجر',       'zh': '商店',    'pt': 'Loja' },
  'nav.history':        { 'en-US': 'History',         'en-GB': 'History',         'fr': 'Historique',      'es': 'Historial',     'de': 'Verlauf',      'ar': 'السجل',        'zh': '历史',    'pt': 'Histórico' },
  'nav.alerts':         { 'en-US': 'Alerts',          'en-GB': 'Alerts',          'fr': 'Alertes',         'es': 'Alertas',       'de': 'Meldungen',    'ar': 'التنبيهات',    'zh': '提醒',    'pt': 'Alertas' },
  'nav.calendar':       { 'en-US': 'Calendar',        'en-GB': 'Calendar',        'fr': 'Calendrier',      'es': 'Calendario',    'de': 'Kalender',     'ar': 'التقويم',      'zh': '日历',    'pt': 'Calendário' },
  'nav.admin':          { 'en-US': 'Admin Panel',     'en-GB': 'Admin Panel',     'fr': 'Admin',           'es': 'Panel Admin',   'de': 'Admin',        'ar': 'لوحة المدير',  'zh': '管理员',  'pt': 'Painel Admin' },
  'nav.signout':        { 'en-US': 'Sign Out',        'en-GB': 'Sign Out',        'fr': 'Se déconnecter',  'es': 'Cerrar sesión', 'de': 'Abmelden',     'ar': 'تسجيل الخروج', 'zh': '退出',    'pt': 'Sair' },

  // ── Common buttons ───────────────────────────────────
  'btn.save':        { 'en-US': 'Save',       'en-GB': 'Save',       'fr': 'Enregistrer', 'es': 'Guardar',   'de': 'Speichern', 'ar': 'حفظ',     'zh': '保存', 'pt': 'Salvar' },
  'btn.cancel':      { 'en-US': 'Cancel',     'en-GB': 'Cancel',     'fr': 'Annuler',     'es': 'Cancelar',  'de': 'Abbrechen', 'ar': 'إلغاء',   'zh': '取消', 'pt': 'Cancelar' },
  'btn.newchat':     { 'en-US': 'New',        'en-GB': 'New',        'fr': 'Nouveau',     'es': 'Nuevo',     'de': 'Neu',       'ar': 'جديد',    'zh': '新建', 'pt': 'Novo' },
  'btn.loading':     { 'en-US': 'Loading…',   'en-GB': 'Loading…',   'fr': 'Chargement…', 'es': 'Cargando…', 'de': 'Laden…',    'ar': '…تحميل',  'zh': '加载中…', 'pt': 'Carregando…' },
  'btn.login':       { 'en-US': 'Log In',     'en-GB': 'Log In',     'fr': 'Connexion',   'es': 'Iniciar sesión', 'de': 'Anmelden', 'ar': 'تسجيل الدخول', 'zh': '登录', 'pt': 'Entrar' },

  // ── Settings titles ───────────────────────────────────
  'settings.title':          { 'en-US': 'Settings',           'en-GB': 'Settings',          'fr': 'Paramètres',        'es': 'Configuración',    'de': 'Einstellungen',     'ar': 'الإعدادات',         'zh': '设置',           'pt': 'Configurações' },
  'settings.notifications':  { 'en-US': 'Notifications',      'en-GB': 'Notifications',     'fr': 'Notifications',     'es': 'Notificaciones',   'de': 'Benachrichtigungen','ar': 'الإشعارات',         'zh': '通知',           'pt': 'Notificações' },
  'settings.tradeAlerts':    { 'en-US': 'Trade Alerts',       'en-GB': 'Trade Alerts',      'fr': 'Alertes de Trade',  'es': 'Alertas de Trade', 'de': 'Handelsmeldungen',  'ar': 'تنبيهات التداول',   'zh': '交易提醒',       'pt': 'Alertas de Trade' },
  'settings.appPrefs':       { 'en-US': 'App Preferences',    'en-GB': 'App Preferences',   'fr': 'Préférences',       'es': 'Preferencias',     'de': 'Einstellungen',     'ar': 'تفضيلات التطبيق',   'zh': '应用偏好',       'pt': 'Preferências' },
  'settings.langRegion':     { 'en-US': 'Language & Region',  'en-GB': 'Language & Region', 'fr': 'Langue & Région',   'es': 'Idioma y Región',  'de': 'Sprache & Region',  'ar': 'اللغة والمنطقة',    'zh': '语言与地区',     'pt': 'Idioma & Região' },
  'settings.security':       { 'en-US': 'Security & Account', 'en-GB': 'Security & Account','fr': 'Sécurité',          'es': 'Seguridad',        'de': 'Sicherheit',        'ar': 'الأمان والحساب',    'zh': '安全与账户',     'pt': 'Segurança' },

  // ── Dashboard ────────────────────────────────────────
  'dashboard.title':      { 'en-US': 'Dashboard',       'en-GB': 'Dashboard',      'fr': 'Tableau de bord', 'es': 'Panel',          'de': 'Übersicht',   'ar': 'لوحة التحكم', 'zh': '仪表板',  'pt': 'Painel' },
  'dashboard.balance':    { 'en-US': 'Total Balance',   'en-GB': 'Total Balance',  'fr': 'Solde Total',     'es': 'Saldo Total',    'de': 'Guthaben',    'ar': 'الرصيد الكلي','zh': '总余额',  'pt': 'Saldo Total' },
  'wallet.available':     { 'en-US': 'Available Balance','en-GB': 'Available Balance','fr': 'Solde disponible','es': 'Saldo disponible','de': 'Verfügbar', 'ar': 'الرصيد المتاح','zh': '可用余额','pt': 'Saldo disponível' },

  // ── Chat ─────────────────────────────────────────────
  'chat.placeholder': { 'en-US': 'Ask about markets, strategies, signals…', 'en-GB': 'Ask about markets, strategies, signals…', 'fr': 'Posez une question sur les marchés…', 'es': 'Pregunta sobre mercados, estrategias…', 'de': 'Frage zu Märkten, Strategien…', 'ar': '…اسأل عن الأسواق والاستراتيجيات', 'zh': '询问市场、策略、信号…', 'pt': 'Pergunte sobre mercados, estratégias…' },
  'chat.disclaimer':  { 'en-US': 'Chat Fin is AI-powered · Not financial advice', 'en-GB': 'Chat Fin is AI-powered · Not financial advice', 'fr': 'Chat Fin est alimenté par IA · Pas de conseil financier', 'es': 'Chat Fin usa IA · No es asesoría financiera', 'de': 'Chat Fin nutzt KI · Keine Finanzberatung', 'ar': 'Chat Fin مدعوم بالذكاء الاصطناعي · ليس نصيحة مالية', 'zh': 'Chat Fin 由 AI 驱动 · 非财务建议', 'pt': 'Chat Fin usa IA · Não é conselho financeiro' },
  'chat.dashboard':   { 'en-US': 'Dashboard', 'en-GB': 'Dashboard', 'fr': 'Tableau de bord', 'es': 'Panel', 'de': 'Übersicht', 'ar': 'لوحة التحكم', 'zh': '仪表板', 'pt': 'Painel' },
  'chat.online':      { 'en-US': 'Online', 'en-GB': 'Online', 'fr': 'En ligne', 'es': 'En línea', 'de': 'Online', 'ar': 'متصل', 'zh': '在线', 'pt': 'Online' },

  // ── Landing page ─────────────────────────────────────
  'land.nav.features': { 'en-US': 'Features', 'en-GB': 'Features', 'fr': 'Fonctionnalités', 'es': 'Características', 'de': 'Funktionen',  'ar': 'الميزات',    'zh': '功能',   'pt': 'Recursos' },
  'land.nav.markets':  { 'en-US': 'Markets',  'en-GB': 'Markets',  'fr': 'Marchés',         'es': 'Mercados',        'de': 'Märkte',      'ar': 'الأسواق',    'zh': '市场',   'pt': 'Mercados' },
  'land.nav.pricing':  { 'en-US': 'Pricing',  'en-GB': 'Pricing',  'fr': 'Tarifs',          'es': 'Precios',         'de': 'Preise',      'ar': 'الأسعار',    'zh': '价格',   'pt': 'Preços' },
  'land.nav.about':    { 'en-US': 'About',    'en-GB': 'About',    'fr': 'À propos',        'es': 'Acerca de',       'de': 'Über uns',    'ar': 'عن التطبيق', 'zh': '关于',   'pt': 'Sobre' },
  'land.hero.badge':   { 'en-US': 'Powered by Grok AI', 'en-GB': 'Powered by Grok AI', 'fr': 'Propulsé par Grok AI', 'es': 'Impulsado por Grok IA', 'de': 'Angetrieben von Grok AI', 'ar': 'مدعوم بـ Grok AI', 'zh': '由 Grok AI 驱动', 'pt': 'Desenvolvido com Grok AI' },
  'land.hero.t1':      { 'en-US': 'Trade Smarter with', 'en-GB': 'Trade Smarter with', 'fr': 'Tradez plus intelligemment avec', 'es': 'Opera más inteligente con', 'de': 'Smarter handeln mit', 'ar': 'تداول بذكاء مع', 'zh': '用', 'pt': 'Negocie mais inteligente com' },
  'land.hero.t2':      { 'en-US': 'AI-Powered Insights', 'en-GB': 'AI-Powered Insights', 'fr': 'l\'Intelligence Artificielle', 'es': 'Inteligencia Artificial', 'de': 'KI-gestützten Einblicken', 'ar': 'رؤى مدعومة بالذكاء الاصطناعي', 'zh': 'AI 驱动的洞察', 'pt': 'Inteligência Artificial' },
  'land.hero.sub':     { 'en-US': 'FinAi reads real-time market news, detects high-impact events, and executes automated trading strategies — driven by Grok AI.', 'en-GB': 'FinAi reads real-time market news, detects high-impact events, and executes automated trading strategies — driven by Grok AI.', 'fr': 'FinAi analyse les actualités du marché en temps réel, détecte les événements à fort impact et exécute des stratégies automatisées — piloté par Grok AI.', 'es': 'FinAi lee noticias del mercado en tiempo real, detecta eventos de alto impacto y ejecuta estrategias automatizadas — impulsado por Grok IA.', 'de': 'FinAi liest Echtzeit-Marktnachrichten, erkennt hochkarätige Ereignisse und führt automatisierte Handelsstrategien aus — angetrieben von Grok AI.', 'ar': 'يقرأ FinAi أخبار السوق في الوقت الفعلي، ويكشف عن الأحداث عالية التأثير، وينفذ استراتيجيات التداول الآلي — مدعوم بـ Grok AI.', 'zh': 'FinAi 实时读取市场新闻，检测高影响事件，并执行自动化交易策略 — 由 Grok AI 驱动。', 'pt': 'FinAi lê notícias do mercado em tempo real, detecta eventos de alto impacto e executa estratégias automatizadas — impulsado por Grok AI.' },
  'land.hero.cta1':    { 'en-US': 'Start Trading Free', 'en-GB': 'Start Trading Free', 'fr': 'Commencer gratuitement', 'es': 'Empieza gratis', 'de': 'Kostenlos starten', 'ar': 'ابدأ التداول مجانًا', 'zh': '免费开始交易', 'pt': 'Comece Grátis' },
  'land.hero.cta2':    { 'en-US': 'View Dashboard', 'en-GB': 'View Dashboard', 'fr': 'Voir le tableau de bord', 'es': 'Ver Panel', 'de': 'Dashboard ansehen', 'ar': 'عرض لوحة التحكم', 'zh': '查看仪表板', 'pt': 'Ver Painel' },
  'land.hero.note':    { 'en-US': 'No credit card required · Free forever plan available', 'en-GB': 'No credit card required · Free forever plan available', 'fr': 'Aucune carte requise · Plan gratuit disponible', 'es': 'Sin tarjeta de crédito · Plan gratuito disponible', 'de': 'Keine Kreditkarte erforderlich · Kostenloses Angebot', 'ar': 'لا يلزم بطاقة ائتمانية · خطة مجانية متاحة', 'zh': '无需信用卡 · 提供永久免费方案', 'pt': 'Sem cartão de crédito · Plano gratuito disponível' },
  'land.login':        { 'en-US': 'Log In', 'en-GB': 'Log In', 'fr': 'Connexion', 'es': 'Iniciar sesión', 'de': 'Anmelden', 'ar': 'تسجيل الدخول', 'zh': '登录', 'pt': 'Entrar' },
}

export const LANGUAGE_NAMES: Record<LangCode, string> = {
  'en-US': 'EN',
  'en-GB': 'EN',
  'fr':    'FR',
  'es':    'ES',
  'de':    'DE',
  'ar':    'AR',
  'zh':    'ZH',
  'pt':    'PT',
}

export const LANGUAGE_FULL: Record<LangCode, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'fr':    'Français',
  'es':    'Español',
  'de':    'Deutsch',
  'ar':    'العربية',
  'zh':    '中文',
  'pt':    'Português',
}

export function t(key: string, lang: LangCode): string {
  return translations[key]?.[lang] ?? translations[key]?.['en-US'] ?? key
}

export function formatCurrency(amount: number, currency: string): string {
  if (currency === 'BTC') {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }
}
