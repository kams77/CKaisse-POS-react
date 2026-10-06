import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Ban,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Flame,
  KeyRound,
  Layers,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Play,
  Plus,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  Trash2,
  User,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AccessLogEntry,
  CurrencyCode,
  EventCategory,
  EventTicketPass,
  FintechRail,
  OfflineScanItem,
  OrganizerPayout,
  StoreSettings,
  TicketingEvent,
  UserRole,
  UserSession,
} from '../types';
import { formatDateTime, formatMoney } from '../utils/format';
import {
  playAlertBuzzer,
  playBlacklistAlarm,
  playSuccessChime,
} from '../utils/audioAlerts';
import { SvgQrCode } from './SvgQrCode';
import { AuthRoleModal } from './AuthRoleModal';
import { TicketPassDetailModal } from './TicketPassDetailModal';
import { BuyerPortalView } from './BuyerPortalView';
import { INITIAL_USER_SESSIONS } from '../data/initialData';

export type SubTab =
  | 'events'
  | 'passes'
  | 'scanner'
  | 'logs'
  | 'organizers'
  | 'monetization'
  | 'buyer';

interface TicketingProjectViewProps {
  events: TicketingEvent[];
  passes: EventTicketPass[];
  accessLogs: AccessLogEntry[];
  organizerPayouts: OrganizerPayout[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  onCreateEvent: (data: {
    title: string;
    category: EventCategory;
    organizerName: string;
    organizerPhone: string;
    venue: string;
    city: string;
    eventDate: string;
    standardPriceUSD: number;
    standardCap: number;
    vipPriceUSD: number;
    vipCap: number;
    vvipPriceUSD: number;
    vvipCap: number;
  }) => TicketingEvent;
  onPurchaseTicketPasses: (payload: {
    eventId: string;
    tierName: 'Standard' | 'VIP' | 'VVIP';
    holderName: string;
    holderPhone: string;
    paymentRail: FintechRail;
    quantity?: number;
    discountPercent?: number;
    guestNames?: string[];
  }) => EventTicketPass[];
  onScanTicketPass: (
    passCode: string,
    gate?: string,
    scannedBy?: string
  ) => {
    outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found' | 'blacklisted';
    pass?: EventTicketPass;
    previousCheckIn?: string;
  };
  onRequestOrganizerPayout: (payload: {
    eventId: string;
    amountUSD: number;
    paymentRail: FintechRail;
    destinationAccount: string;
  }) => void;
  onClearAccessLogs: () => void;
  activeSubTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  currentUserSession?: UserSession;
  onUpdateUserSession?: (session: UserSession) => void;
  onBlacklistPass?: (passId: string, reason: string) => void;
  onReactivatePass?: (passId: string) => void;
  onSyncOfflineScans?: (scans: OfflineScanItem[]) => void;
}

const EVENT_CATEGORIES: EventCategory[] = [
  'Concert & Festival',
  'Conférence & Business',
  'Formation & Masterclass',
  'Sport & Match',
  'Soirée & Gala',
];

const RAILS: FintechRail[] = [
  'M-Pesa',
  'Orange Money',
  'Airtel Money',
  'Wave',
  'MTN MoMo',
  'Visa / Mastercard',
];

const GATES = [
  'Porte A (VIP & VVIP)',
  'Entrée Principale (Standard)',
  'Porte Ouest (Guichet Rapide)',
  'Accès Staff & Presse',
];

const SECURITY_AGENTS = [
  'Agent Sécurité Cédric (Porte A)',
  'Agent Contrôle Sarah (Entrée Principale)',
  'Superviseur Éric (Filtrage Mobile)',
];

export const TicketingProjectView: React.FC<TicketingProjectViewProps> = ({
  events,
  passes,
  accessLogs,
  organizerPayouts,
  displayCurrency,
  settings,
  onCreateEvent,
  onPurchaseTicketPasses,
  onScanTicketPass,
  onRequestOrganizerPayout,
  onClearAccessLogs,
  activeSubTab,
  onSubTabChange,
  currentUserSession = INITIAL_USER_SESSIONS.admin,
  onUpdateUserSession,
  onBlacklistPass,
  onReactivatePass,
  onSyncOfflineScans,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<SubTab>('events');
  const subTab = activeSubTab !== undefined ? activeSubTab : internalSubTab;
  const setSubTab = (tab: SubTab) => {
    setInternalSubTab(tab);
    onSubTabChange?.(tab);
  };
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Auth & Roles Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Offline Mode (Stade sans réseau)
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineScansQueue, setOfflineScansQueue] = useState<OfflineScanItem[]>([]);

  // Create Event Modal state
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtCategory, setEvtCategory] = useState<EventCategory>('Concert & Festival');
  const [evtOrganizer, setEvtOrganizer] = useState(currentUserSession.name || '');
  const [evtPhone, setEvtPhone] = useState(currentUserSession.phone || '+243 ');
  const [evtVenue, setEvtVenue] = useState('Stade des Martyrs (Kinshasa)');
  const [evtCity, setEvtCity] = useState('Kinshasa');
  const [evtDate, setEvtDate] = useState('2026-11-20T19:00');
  const [stdPrice, setStdPrice] = useState('15');
  const [stdCap, setStdCap] = useState('500');
  const [vipPrice, setVipPrice] = useState('45');
  const [vipCap, setVipCap] = useState('120');
  const [vvipPrice, setVvipPrice] = useState('120');
  const [vvipCap, setVvipCap] = useState('30');

  // Purchase Modal with Mobile Money processing state
  const [buyingEvent, setBuyingEvent] = useState<TicketingEvent | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'processing_payment' | 'confirmed'>('form');
  const [selectedTier, setSelectedTier] = useState<'Standard' | 'VIP' | 'VVIP'>('VIP');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoPercent, setAppliedPromoPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('+243 81 ');
  const [buyerRail, setBuyerRail] = useState<FintechRail>('M-Pesa');
  const [guestNames, setGuestNames] = useState<string[]>(['']);
  const [generatedPurchasedPasses, setGeneratedPurchasedPasses] = useState<EventTicketPass[]>([]);
  const [paymentTransactionRef, setPaymentTransactionRef] = useState('');

  // Pass Detail Modal (Anti-screenshot QR & Share)
  const [inspectedPass, setInspectedPass] = useState<EventTicketPass | null>(null);

  // Scanner state
  const [selectedGate, setSelectedGate] = useState(GATES[0]);
  const [selectedAgent, setSelectedAgent] = useState(currentUserSession.name || SECURITY_AGENTS[0]);
  const [scanInput, setScanInput] = useState('');
  const [isScanningActive, setIsScanningActive] = useState(true);
  const [scanResult, setScanResult] = useState<{
    outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found' | 'blacklisted';
    pass?: EventTicketPass;
    previousCheckIn?: string;
    scannedCode: string;
    gate?: string;
    scannedBy?: string;
    offlineModeActive?: boolean;
  } | null>(null);

  // Passes search & filters
  const [passSearch, setPassSearch] = useState('');
  const [passEventFilter, setPassEventFilter] = useState('all');
  const [passStatusFilter, setPassStatusFilter] = useState<'all' | 'valid' | 'used' | 'blacklisted'>('all');

  // Logs search & filters
  const [logSearch, setLogSearch] = useState('');
  const [logResultFilter, setLogResultFilter] = useState<'all' | 'granted' | 'duplicate_denied' | 'invalid_unknown' | 'blacklisted_denied'>('all');

  // Organizer Payout Modal
  const [payoutEvent, setPayoutEvent] = useState<TicketingEvent | null>(null);
  const [payoutRail, setPayoutRail] = useState<FintechRail>('M-Pesa');
  const [payoutDestination, setPayoutDestination] = useState('');
  const [payoutAmountUSD, setPayoutAmountUSD] = useState('');

  // Metrics calculation
  const metrics = useMemo(() => {
    let totalTicketsSold = 0;
    let totalGrossUSD = 0;

    for (const ev of events) {
      for (const tier of ev.tiers) {
        totalTicketsSold += tier.sold;
        totalGrossUSD += tier.sold * tier.priceUSD;
      }
    }

    const totalCommissionUSD = totalGrossUSD * 0.07;
    const checkedInPassesCount = passes.filter((p) => p.status === 'used').length;
    const blacklistedPassesCount = passes.filter((p) => p.status === 'blacklisted').length;
    const totalOrganizerPayoutsUSD = organizerPayouts.reduce((acc, p) => acc + p.amountUSD, 0);

    return {
      totalTicketsSold,
      totalGrossUSD,
      totalCommissionUSD,
      checkedInPassesCount,
      blacklistedPassesCount,
      totalOrganizerPayoutsUSD,
    };
  }, [events, passes, organizerPayouts]);

  // Handle Event Creation
  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtVenue.trim()) return;
    onCreateEvent({
      title: evtTitle.trim(),
      category: evtCategory,
      organizerName: evtOrganizer.trim() || currentUserSession.name,
      organizerPhone: evtPhone.trim(),
      venue: evtVenue.trim(),
      city: evtCity.trim(),
      eventDate: new Date(evtDate).toISOString(),
      standardPriceUSD: Math.max(1, parseFloat(stdPrice) || 10),
      standardCap: Math.max(1, parseInt(stdCap, 10) || 100),
      vipPriceUSD: Math.max(1, parseFloat(vipPrice) || 35),
      vipCap: Math.max(1, parseInt(vipCap, 10) || 50),
      vvipPriceUSD: Math.max(1, parseFloat(vvipPrice) || 100),
      vvipCap: Math.max(1, parseInt(vvipCap, 10) || 15),
    });
    setEvtTitle('');
    setEvtVenue('');
    setIsCreateEventOpen(false);
  };

  // Promo Code Validation
  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (code === 'EARLYBIRD' || code === 'EARLY10') {
      setAppliedPromoPercent(10);
      setPromoMessage('Code promo EARLYBIRD validé : -10%');
    } else if (code === 'VIP2026' || code === 'KOLA15') {
      setAppliedPromoPercent(15);
      setPromoMessage('Code privilège VIP2026 validé : -15%');
    } else if (code === 'FESTIVAL20' || code === 'STADE20') {
      setAppliedPromoPercent(20);
      setPromoMessage('Code promotionnel -20% appliqué !');
    } else {
      setAppliedPromoPercent(0);
      setPromoMessage('Code promotionnel invalide');
    }
  };

  // Step 1: Initiate Payment
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyingEvent || !buyerName.trim()) return;
    setCheckoutStep('processing_payment');

    // Simulate authentic Mobile Money USSD push transaction delay (1.4s)
    setTimeout(() => {
      const txRef = `${buyerRail.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}-TX-${Date.now().toString().slice(-6)}`;
      setPaymentTransactionRef(txRef);

      const generated = onPurchaseTicketPasses({
        eventId: buyingEvent.id,
        tierName: selectedTier,
        holderName: buyerName.trim(),
        holderPhone: buyerPhone.trim(),
        paymentRail: buyerRail,
        quantity: ticketQuantity,
        discountPercent: appliedPromoPercent,
        guestNames: guestNames.map((g, idx) =>
          g.trim() ? g.trim() : `${buyerName.trim()} (Billet #${idx + 1})`
        ),
      });

      setGeneratedPurchasedPasses(generated);
      setCheckoutStep('confirmed');
    }, 1400);
  };

  // Scan Verification Engine
  const triggerScanVerification = (codeToScan: string) => {
    const raw = codeToScan.trim().toUpperCase();
    const cleanCode = raw.split('#')[0].trim();
    if (!cleanCode) return;

    // OFFLINE MODE ENGINE
    if (isOfflineMode) {
      const localPass = passes.find((p) => p.passCode.toUpperCase() === cleanCode);
      let outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found' | 'blacklisted' = 'not_found';

      if (!localPass) {
        outcome = 'not_found';
        if (soundEnabled) playAlertBuzzer();
      } else if (localPass.status === 'blacklisted') {
        outcome = 'blacklisted';
        if (soundEnabled) playBlacklistAlarm();
      } else if (localPass.status === 'used') {
        outcome = 'fraud_duplicate';
        if (soundEnabled) playAlertBuzzer();
      } else {
        outcome = 'valid_entry';
        if (soundEnabled) playSuccessChime();
      }

      const offlineItem: OfflineScanItem = {
        id: `off-${Date.now()}`,
        timestamp: new Date().toISOString(),
        passCode: cleanCode,
        gate: selectedGate,
        scannedBy: selectedAgent,
        scannedAtOffline: new Date().toLocaleTimeString('fr-FR'),
        outcome,
      };

      setOfflineScansQueue((prev) => [offlineItem, ...prev]);
      setScanResult({
        outcome,
        pass: localPass,
        scannedCode: cleanCode,
        gate: selectedGate,
        scannedBy: selectedAgent,
        offlineModeActive: true,
      });
      return;
    }

    // ONLINE STANDARD VERIFICATION
    const res = onScanTicketPass(cleanCode, selectedGate, selectedAgent);

    if (res.outcome === 'valid_entry') {
      if (soundEnabled) playSuccessChime();
    } else if (res.outcome === 'blacklisted') {
      if (soundEnabled) playBlacklistAlarm();
    } else {
      if (soundEnabled) playAlertBuzzer();
    }

    setScanResult({
      ...res,
      scannedCode: cleanCode,
      gate: selectedGate,
      scannedBy: selectedAgent,
      offlineModeActive: false,
    });
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerScanVerification(scanInput);
    setScanInput('');
  };

  // Sync Offline Scans to Main Server
  const handleSyncOfflineQueue = () => {
    if (offlineScansQueue.length === 0) return;
    onSyncOfflineScans?.(offlineScansQueue);
    setOfflineScansQueue([]);
    setIsOfflineMode(false);
  };

  // Filter Passes
  const filteredPasses = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    return passes.filter((p) => {
      const matchesQuery =
        !q ||
        p.passCode.toLowerCase().includes(q) ||
        p.holderName.toLowerCase().includes(q) ||
        p.eventTitle.toLowerCase().includes(q) ||
        p.tierName.toLowerCase().includes(q);

      const matchesEvent = passEventFilter === 'all' || p.eventId === passEventFilter;
      const matchesStatus = passStatusFilter === 'all' || p.status === passStatusFilter;

      return matchesQuery && matchesEvent && matchesStatus;
    });
  }, [passes, passSearch, passEventFilter, passStatusFilter]);

  // Filter Logs
  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return accessLogs.filter((l) => {
      const matchesQuery =
        !q ||
        l.passCode.toLowerCase().includes(q) ||
        l.holderName.toLowerCase().includes(q) ||
        l.eventTitle.toLowerCase().includes(q) ||
        l.gate.toLowerCase().includes(q) ||
        l.scannedBy.toLowerCase().includes(q);

      const matchesResult = logResultFilter === 'all' || l.result === logResultFilter;
      return matchesQuery && matchesResult;
    });
  }, [accessLogs, logSearch, logResultFilter]);

  // Intercepted Fraud Scans (duplicate or blacklisted)
  const fraudLogs = useMemo(() => {
    return accessLogs.filter(
      (l) => l.result === 'duplicate_denied' || l.result === 'blacklisted_denied'
    );
  }, [accessLogs]);

  // Export CSV
  const handleExportAttendeesCSV = () => {
    const headers = [
      'Code Billet',
      'Signature HMAC',
      'Participant',
      'Telephone',
      'Evenement',
      'Categorie',
      'Prix Paye USD',
      'Mode Paiement',
      'Date Achat',
      'Statut Entree',
      'Heure Entree',
      'Porte',
    ];

    const rows = filteredPasses.map((p) => [
      `"${p.passCode}"`,
      `"${p.qrSignature}"`,
      `"${p.holderName.replace(/"/g, '""')}"`,
      `"${p.holderPhone}"`,
      `"${p.eventTitle.replace(/"/g, '""')}"`,
      `"${p.tierName}"`,
      p.pricePaidUSD.toFixed(2),
      `"${p.paymentRail}"`,
      `"${p.purchasedAt}"`,
      `"${p.status === 'used' ? 'DEJA ENTRE' : p.status === 'blacklisted' ? 'BLACKLISTE' : 'VALIDE'}"`,
      `"${p.checkedInAt || ''}"`,
      `"${p.checkedInGate || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kolapass_participants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRequestPayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutEvent || !payoutDestination.trim()) return;
    const amount = parseFloat(payoutAmountUSD) || 0;
    if (amount <= 0) return;

    onRequestOrganizerPayout({
      eventId: payoutEvent.id,
      amountUSD: amount,
      paymentRail: payoutRail,
      destinationAccount: payoutDestination.trim(),
    });

    setPayoutEvent(null);
    setPayoutDestination('');
    setPayoutAmountUSD('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Sky-Blue background with crisp Crimson accents and clear borders */}
      <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-rose-800 tracking-wide uppercase">
              <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5">
                KolaPass Pro
              </span>
              <span aria-hidden="true">·</span>
              <span>Billetterie Sécurisée (JWT & HMAC)</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-800">Anti-Screenshot 30s</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Portique Anti-Fraude & Billetterie Mobile Money (Orange, Airtel, M-Pesa)
            </h1>
            <p className="text-xs text-slate-500 max-w-3xl">
              Génération de billets cryptographiques infalsifiables avec filigrane dynamique, QR code à usage unique, scan hors-ligne pour stade et contrôle des rôles 2FA.
            </p>
          </div>

          {/* Quick Action Buttons & Role Badge */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* User Session Badge with click to open Auth Modal */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-950 hover:bg-sky-100 transition-colors shadow-2xs"
              title="Changer de compte ou vérifier le rôle 2FA"
            >
              <img
                src={currentUserSession.avatarUrl}
                alt={currentUserSession.name}
                className="h-5 w-5 rounded-full border border-sky-400 object-cover"
              />
              <span className="truncate max-w-[120px]">{currentUserSession.name.split(' ')[0]}</span>
              <span className="rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0.2 text-[10px] uppercase font-mono font-bold text-rose-800">
                {currentUserSession.role}
              </span>
            </button>

            {/* Offline Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setIsOfflineMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all shadow-2xs ${
                isOfflineMode
                  ? 'border-amber-400 bg-amber-100 text-amber-950 animate-pulse'
                  : 'border-sky-300 bg-white text-slate-700 hover:bg-sky-50'
              }`}
              title="Active la validation locale sur cache sans connexion Internet au stade"
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="h-4 w-4 text-amber-700" />
                  <span>Mode Stade (Hors-Ligne)</span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 text-emerald-600" />
                  <span>En Ligne</span>
                </>
              )}
            </button>

            {/* Create Event Button (for admin / organizer) */}
            <button
              type="button"
              onClick={() => setIsCreateEventOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Créer Événement</span>
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-sky-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              title={soundEnabled ? 'Désactiver les bips du scanner' : 'Activer les bips du scanner'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Offline Queue Sync Alert if scans in buffer */}
        {offlineScansQueue.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                {offlineScansQueue.length} scan(s) en attente de synchronisation réseau au stade !
              </span>
            </div>
            <button
              type="button"
              onClick={handleSyncOfflineQueue}
              className="rounded-lg border-2 border-amber-500 bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 shadow-2xs"
            >
              Synchroniser Maintenant ({offlineScansQueue.length})
            </button>
          </div>
        )}

        {/* Crisp Subtab Navigation - Gray Buttons */}
        <div className="mt-5 border-t-2 border-slate-200 pt-4 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-100 p-2">
          {[
            { id: 'events', label: '1. Événements & Vente', count: events.length },
            { id: 'scanner', label: '2. Portique Caméra (Entrée)', highlight: true },
            { id: 'passes', label: '3. Billets & Pass Émis', count: passes.length },
            { id: 'logs', label: '4. Journal des Scans (Audit)', count: accessLogs.length },
            { id: 'organizers', label: '5. Reversements Promoteurs' },
            { id: 'monetization', label: '6. Rentabilité (7%)' },
            { id: 'buyer', label: '7. 👁️ Démo Acheteur Public', highlight: true },
          ].map((tab) => {
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as SubTab)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border-2 shadow-2xs ${
                  isActive
                    ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isActive ? 'bg-slate-700 text-slate-100 border border-slate-600' : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.highlight && !isActive && (
                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Crisp Metric Cards with Sky-Blue & Crimson Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Recettes Brutes Billetterie
          </span>
          <div className="mt-1 text-2xl font-black text-slate-900 font-mono tabular-nums">
            {formatMoney(metrics.totalGrossUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            {metrics.totalTicketsSold.toLocaleString('fr-FR')} billet(s) écoulé(s)
          </p>
        </div>

        <div className="rounded-2xl border-2 border-rose-300 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
            Commission KolaPass (7,0%)
          </span>
          <div className="mt-1 text-2xl font-black text-rose-700 font-mono tabular-nums">
            +{formatMoney(metrics.totalCommissionUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Prélèvement automatique à chaque vente Mobile Money
          </p>
        </div>

        <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Entrées Émargées (Stade)
          </span>
          <div className="mt-1 text-2xl font-black text-emerald-700 font-mono tabular-nums">
            {metrics.checkedInPassesCount} / {passes.length}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            Taux de présence au portique :{' '}
            {passes.length > 0
              ? Math.round((metrics.checkedInPassesCount / passes.length) * 100)
              : 0}
            %
          </p>
        </div>

        <div className="rounded-2xl border-2 border-rose-300 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Tentatives Fraude / Doublons
            </span>
            <span className="rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-700">
              {fraudLogs.length} bloqués
            </span>
          </div>
          <div className="mt-1 text-2xl font-black text-rose-800 font-mono tabular-nums">
            {metrics.blacklistedPassesCount} Billet(s) Blacklisté(s)
          </div>
          <p className="mt-1 text-xs text-rose-700 font-medium">
            Captures d&apos;écran et doublons rejetés d&apos;office
          </p>
        </div>
      </div>

      {/* SUBTAB 1: EVENTS CATALOG & SALES */}
      {subTab === 'events' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-200 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Événements Programmés & Guichet Mobile Money
              </h2>
              <p className="text-xs text-slate-500">
                Achat immédiat sécurisé par M-Pesa, Orange Money, Airtel Money, Wave ou Carte bancaire.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateEventOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau Concert / Conférence</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((ev) => {
              const totalCap = ev.tiers.reduce((s, t) => s + t.capacity, 0);
              const totalSold = ev.tiers.reduce((s, t) => s + t.sold, 0);
              const fillPct = Math.min(100, Math.round((totalSold / totalCap) * 100));
              const eventRevenueUSD = ev.tiers.reduce((s, t) => s + t.sold * t.priceUSD, 0);
              const myCommissionUSD = eventRevenueUSD * (ev.commissionRatePercent / 100);

              const eventDateObj = new Date(ev.eventDate);
              const dayNum = eventDateObj.getDate();
              const monthStr = eventDateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase();

              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border-2 border-sky-300 bg-white overflow-hidden shadow-xs hover:border-sky-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                          {ev.category}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 leading-snug mt-1">
                          {ev.title}
                        </h3>
                      </div>

                      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-sky-200 bg-sky-50 px-2.5 py-1 font-mono text-center shrink-0">
                        <span className="text-base font-black text-slate-900 leading-none">{dayNum}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight mt-0.5">{monthStr}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        <span className="font-mono">{formatDateTime(ev.eventDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">{ev.venue} ({ev.city})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Promoteur : {ev.organizerName}</span>
                      </div>
                    </div>

                    {/* Progress Bar of Capacity */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 font-bold">
                        <span>Places écoulées</span>
                        <span className="text-slate-900">{fillPct}% ({totalSold}/{totalCap})</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillPct > 85 ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Tiers Pricing Grid */}
                    <div className="rounded-xl border-2 border-sky-200 bg-sky-50/50 p-3 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                        <span>Catégorie</span>
                        <span>Tarif</span>
                        <span>Dispo</span>
                      </div>
                      {ev.tiers.map((t) => (
                        <div key={t.id} className="flex items-center justify-between border-t border-sky-200/80 pt-1">
                          <span className="font-sans font-bold text-slate-800">{t.name}</span>
                          <span className="font-bold text-rose-800">{formatMoney(t.priceUSD, displayCurrency, settings.rates)}</span>
                          <span className="text-slate-500">{t.sold}/{t.capacity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="border-t-2 border-sky-100 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-sans text-slate-500">Commission ({ev.commissionRatePercent}%) :</span>
                      <span className="font-bold text-rose-800">+{formatMoney(myCommissionUSD, displayCurrency, settings.rates)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBuyingEvent(ev);
                          setCheckoutStep('form');
                          setSelectedTier('Standard');
                          setTicketQuantity(1);
                          setBuyerName('');
                          setBuyerPhone('+243 81 ');
                          setGuestNames(['']);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-700 py-2.5 px-3 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-2xs"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        <span>Acheter (M-Pesa)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayoutEvent(ev);
                          setPayoutAmountUSD(
                            Math.max(0, eventRevenueUSD - myCommissionUSD).toFixed(2)
                          );
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-sky-300 bg-white py-2.5 px-3 text-xs font-bold text-sky-950 hover:bg-sky-50 transition-colors"
                      >
                        <Wallet className="h-3.5 w-3.5 text-sky-700" />
                        <span>Virement 93%</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSubTab('buyer')}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white py-2 px-3 text-xs font-bold text-slate-700 hover:border-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-600" />
                      <span>👁️ Démo : Voir l&apos;écran d&apos;un Acheteur Tiers</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: SCANNER & CHECK-IN (CAMERA / OFFLINE STADIUM APP) */}
      {subTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Camera Viewfinder & Sound Flash */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-100 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-rose-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Viseur de Contrôle d&apos;Entrée (Portique Direct)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${
                    isOfflineMode ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                    <span>{isOfflineMode ? 'Mode Stade Hors-Ligne' : 'Connecté Serveur'}</span>
                  </span>
                </div>
              </div>

              {/* Gate & Agent Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Porte d&apos;accès :</label>
                  <select
                    value={selectedGate}
                    onChange={(e) => setSelectedGate(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    {GATES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agent en poste :</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    {SECURITY_AGENTS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interactive Camera Viewfinder Box */}
              <div className="relative aspect-video w-full rounded-2xl border-4 border-slate-900 bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-6 text-white shadow-inner">
                {/* Visual Screen Flash when scanned */}
                {scanResult && (
                  <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-700 z-10 ${
                      scanResult.outcome === 'valid_entry'
                        ? 'bg-emerald-600/30 ring-8 ring-emerald-500 inset-ring'
                        : scanResult.outcome === 'blacklisted'
                        ? 'bg-rose-700/50 ring-8 ring-rose-600 inset-ring animate-pulse'
                        : 'bg-rose-600/35 ring-8 ring-rose-500 inset-ring'
                    }`}
                  />
                )}

                {/* Laser scan line animation */}
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_15px_#f43f5e] animate-pulse" />

                {/* Reticle Finder Corners */}
                <div className="relative h-44 w-44 rounded-2xl border-2 border-dashed border-rose-400/80 flex items-center justify-center">
                  <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-rose-400" />
                  <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-rose-400" />
                  <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-rose-400" />
                  <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-rose-400" />
                  <ScanLine className="h-10 w-10 text-rose-400 animate-pulse" />
                </div>

                <div className="mt-4 text-center z-20">
                  <div className="font-mono text-xs font-bold text-rose-400 tracking-wider">
                    [CAMÉRA HD PRÊTE — DÉTECTION RAPIDE]
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Présentez le pass QR mobile ou papier devant le viseur
                  </p>
                </div>
              </div>

              {/* Manual code input & Test Scan buttons */}
              <form onSubmit={handleManualScanSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Code pass (ex: EVT101-8F3K9X2Q ou clic ci-dessous)"
                  className="flex-1 rounded-xl border-2 border-sky-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 shadow-xs"
                >
                  Valider
                </button>
              </form>

              {/* Quick test buttons */}
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-500">Test rapide :</span>
                {passes.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setScanInput(p.passCode);
                      triggerScanVerification(p.passCode);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono font-bold transition-colors ${
                      p.status === 'blacklisted'
                        ? 'border-rose-400 bg-rose-50 text-rose-900 hover:bg-rose-100'
                        : p.status === 'used'
                        ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                    }`}
                  >
                    {p.passCode} ({p.status})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Scan Result Card & Check-in Photo/Name Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 border-b-2 border-sky-100 pb-3">
                Résultat d&apos;Émargement en Direct
              </h3>

              {scanResult ? (
                <div className="mt-4 space-y-4">
                  {/* Outcome Banner */}
                  {scanResult.outcome === 'valid_entry' && (
                    <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-emerald-950">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-base font-black">ACCÈS VALIDE & AUTORISÉ</div>
                          <div className="text-xs text-emerald-800 font-semibold">
                            Billet marqué USAGE UNIQUE dans le système
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {scanResult.outcome === 'blacklisted' && (
                    <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 text-rose-950 animate-bounce">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
                        <div>
                          <div className="text-base font-black uppercase">REFUS: BILLET SUR LISTE NOIRE</div>
                          <div className="text-xs text-rose-800 font-bold">
                            Opposition formelle: {scanResult.pass?.blacklistReason || 'Fraude signalée'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {scanResult.outcome === 'fraud_duplicate' && (
                    <div className="rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 text-rose-950">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0" />
                        <div>
                          <div className="text-base font-black uppercase">REFUS: DOUBLON DÉTECTÉ</div>
                          <div className="text-xs text-rose-800 font-semibold">
                            Tentative n°{scanResult.pass?.scanAttempts} · Déjà scanné à {scanResult.previousCheckIn ? new Date(scanResult.previousCheckIn).toLocaleTimeString('fr-FR') : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {scanResult.outcome === 'not_found' && (
                    <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 text-slate-900">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-6 w-6 text-slate-500 shrink-0" />
                        <div>
                          <div className="text-base font-black">BILLET NON RÉPERTORIÉ</div>
                          <div className="text-xs text-slate-600">
                            Code QR introuvable ou signature invalide
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attendee Details & Avatar Card */}
                  {scanResult.pass && (
                    <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            scanResult.pass.avatarUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                          }
                          alt={scanResult.pass.holderName}
                          className="h-16 w-16 rounded-full border-2 border-sky-400 object-cover shadow-sm"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                            Catégorie {scanResult.pass.tierName}
                          </span>
                          <h4 className="mt-1 text-base font-black text-slate-900 truncate">
                            {scanResult.pass.holderName}
                          </h4>
                          <p className="font-mono text-xs text-slate-500">
                            {scanResult.pass.holderPhone}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-sky-200/80 pt-2 text-xs space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-sans">Événement :</span>
                          <span className="font-bold text-slate-900 truncate max-w-[200px]">
                            {scanResult.pass.eventTitle}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-sans">Lieu / Porte :</span>
                          <span className="font-bold text-slate-900">
                            {scanResult.gate}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-sans">Paiement :</span>
                          <span>
                            {scanResult.pass.paymentRail} · {formatMoney(scanResult.pass.pricePaidUSD, displayCurrency, settings.rates)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectedPass(scanResult.pass || null)}
                          className="rounded-xl border-2 border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-950 hover:bg-sky-50 shadow-2xs"
                        >
                          Détails Billet & WhatsApp
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-8 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <ScanLine className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">
                    Aucun billet scanné pour le moment.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Les informations du participant s&apos;afficheront ici instantanément.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PASSES LIST & ANTI-FRAUD MANAGEMENT */}
      {subTab === 'passes' && (
        <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Répertoire des Billets Émis & Gestion de la Sécurité
              </h2>
              <p className="text-xs text-slate-500">
                Consultation des pass QR dynamiques, envoi WhatsApp/Email/SMS et mise sur liste noire (Blacklist).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAttendeesCSV}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-950 hover:bg-sky-100 transition-colors shadow-2xs"
              >
                <Download className="h-4 w-4 text-sky-700" />
                <span>Exporter CSV Participants</span>
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={passSearch}
                onChange={(e) => setPassSearch(e.target.value)}
                placeholder="Rechercher code, nom, concert..."
                className="w-full rounded-xl border-2 border-sky-200 bg-white pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={passEventFilter}
                onChange={(e) => setPassEventFilter(e.target.value)}
                className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-rose-600 focus:outline-none"
              >
                <option value="all">Tous les événements</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={passStatusFilter}
                onChange={(e) => setPassStatusFilter(e.target.value as any)}
                className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-rose-600 focus:outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="valid">Valides (Non émargés)</option>
                <option value="used">Déjà Utilisés (Émargés)</option>
                <option value="blacklisted">Blacklistés (Fraude)</option>
              </select>
            </div>
          </div>

          {/* Passes Table */}
          <div className="overflow-x-auto rounded-xl border-2 border-sky-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 border-sky-200 bg-sky-50 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Code Billet (EVT)</th>
                  <th className="p-3">Participant</th>
                  <th className="p-3">Événement & Catégorie</th>
                  <th className="p-3">Montant / Canal</th>
                  <th className="p-3">Statut Entrée</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 font-medium">
                {filteredPasses.length > 0 ? (
                  filteredPasses.map((p) => (
                    <tr key={p.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-rose-800">{p.passCode}</div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
                          {p.qrSignature}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              p.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                            }
                            alt={p.holderName}
                            className="h-7 w-7 rounded-full border border-sky-300 object-cover shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{p.holderName}</div>
                            <div className="font-mono text-[10px] text-slate-500">{p.holderPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 truncate max-w-[180px]">{p.eventTitle}</div>
                        <div className="text-[10px] font-semibold text-rose-700">ACCÈS {p.tierName}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-bold text-slate-900">
                          {formatMoney(p.pricePaidUSD, displayCurrency, settings.rates)}
                        </div>
                        <div className="text-[10px] text-slate-500">{p.paymentRail}</div>
                      </td>
                      <td className="p-3">
                        {p.status === 'valid' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Valide
                          </span>
                        )}
                        {p.status === 'used' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            <Clock className="h-3 w-3 text-slate-500" />
                            Émargé ({p.checkedInGate || 'Entrée'})
                          </span>
                        )}
                        {p.status === 'blacklisted' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                            <Ban className="h-3 w-3 text-rose-600" />
                            Blacklisté
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectedPass(p)}
                          className="rounded-lg border-2 border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-950 hover:bg-sky-50 shadow-2xs"
                        >
                          Gérer / QR & WhatsApp
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Aucun billet ne correspond à votre recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: AUDIT LOGS & FRAUD INTERCEPTION */}
      {subTab === 'logs' && (
        <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Journal d&apos;Audit des Scans & Alertes Fraude en Direct
              </h2>
              <p className="text-xs text-slate-500">
                Traçabilité seconde par seconde des passages au portique avec agent et porte d&apos;accès.
              </p>
            </div>
            <button
              type="button"
              onClick={onClearAccessLogs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Vider le journal</span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filtrer par code, nom, porte ou agent..."
                className="w-full rounded-xl border-2 border-sky-200 bg-white pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={logResultFilter}
                onChange={(e) => setLogResultFilter(e.target.value as any)}
                className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-rose-600 focus:outline-none"
              >
                <option value="all">Tous les résultats de scan</option>
                <option value="granted">Autorisés (Accès Valide)</option>
                <option value="duplicate_denied">Refusés (Fraude Doublon)</option>
                <option value="blacklisted_denied">Refusés (Billet Blacklisté)</option>
                <option value="invalid_unknown">Inconnus / Contrefaits</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-xl border-2 border-sky-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 border-sky-200 bg-sky-50 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Horodatage</th>
                  <th className="p-3">Code Billet</th>
                  <th className="p-3">Titulaire</th>
                  <th className="p-3">Porte / Agent</th>
                  <th className="p-3">Résultat & Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 font-medium">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-sky-50/50">
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(l.timestamp)}
                      </td>
                      <td className="p-3 font-mono font-bold text-rose-800">
                        {l.passCode}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {l.holderName}
                      </td>
                      <td className="p-3 text-[11px]">
                        <div className="font-bold text-slate-800">{l.gate}</div>
                        <div className="text-slate-500">{l.scannedBy}</div>
                      </td>
                      <td className="p-3">
                        {l.result === 'granted' && (
                          <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>{l.notes || 'Entrée accordée'}</span>
                          </div>
                        )}
                        {l.result === 'duplicate_denied' && (
                          <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                            <span>{l.notes || 'Fraude doublon interceptée'}</span>
                          </div>
                        )}
                        {l.result === 'blacklisted_denied' && (
                          <div className="flex items-center gap-1.5 text-rose-900 font-black">
                            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                            <span>{l.notes || 'Billet sur liste noire'}</span>
                          </div>
                        )}
                        {l.result === 'invalid_unknown' && (
                          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                            <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
                            <span>{l.notes || 'Code invalide'}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Aucun scan enregistré dans cette vue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 5: ORGANIZER PAYOUTS (REVERSEMENTS 93%) */}
      {subTab === 'organizers' && (
        <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Reversements Financiers Promoteurs & Organisateurs
              </h2>
              <p className="text-xs text-slate-500">
                Ordres de virement automatisés vers M-Pesa, Orange Money, Airtel Money, Wave ou Banque après retenue de la commission 7,0%.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-sky-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 border-sky-200 bg-sky-50 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">ID Reversement</th>
                  <th className="p-3">Événement & Organisateur</th>
                  <th className="p-3">Montant Versé</th>
                  <th className="p-3">Canal de Règlement</th>
                  <th className="p-3">Compte Réception</th>
                  <th className="p-3">Statut Virement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 font-medium">
                {organizerPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-sky-50/50">
                    <td className="p-3 font-mono font-bold text-slate-900">{p.id}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{p.eventTitle}</div>
                      <div className="text-[10px] text-slate-500">{p.organizerName}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-800">
                      {formatMoney(p.amountUSD, displayCurrency, settings.rates)}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{p.paymentRail}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{p.destinationAccount}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Effectué
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 6: MONETIZATION & PLATFORM ANNUAL REVENUE */}
      {subTab === 'monetization' && (
        <div className="rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b-2 border-sky-100 pb-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Modèle Économique & Rentabilité KolaPass (Commission 7%)
            </h2>
            <p className="text-xs text-slate-500">
              Chaque billet émis génère instantanément 7,0% de marge brute directement prélevée lors de la transaction Mobile Money.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/60 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Commission Plateforme
              </span>
              <div className="mt-1 text-2xl font-black text-slate-900">7,0 %</div>
              <p className="mt-1 text-xs text-slate-500">
                0 frais caché. Aucun coût d&apos;installation de matériel pour l&apos;organisateur.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/60 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Reversement Promoteur
              </span>
              <div className="mt-1 text-2xl font-black text-rose-900">93,0 %</div>
              <p className="mt-1 text-xs text-slate-500">
                Versé dès la fin de l&apos;événement sur M-Pesa ou compte bancaire sous 24h.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Sécurité & Anti-Fraude
              </span>
              <div className="mt-1 text-2xl font-black text-emerald-900">100 % Sécurisé</div>
              <p className="mt-1 text-xs text-slate-500">
                Signatures HMAC-SHA256, tokens JWT et QR codes dynamiques anti-capture.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 7: DÉMO ÉCRAN ACHETEUR TIERS / PORTAIL PUBLIC */}
      {subTab === 'buyer' && (
        <BuyerPortalView
          events={events}
          passes={passes}
          displayCurrency={displayCurrency}
          settings={settings}
          onPurchasePasses={onPurchaseTicketPasses}
          onExitToConsole={() => setSubTab('events')}
        />
      )}

      {/* MODAL 1: AUTH & ROLES (ADMIN / ORGANISATEUR / AGENT) WITH 2FA SMS */}
      <AuthRoleModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentSession={currentUserSession}
        onUpdateSession={(newSess) => {
          onUpdateUserSession?.(newSess);
          setSelectedAgent(newSess.name);
        }}
      />

      {/* MODAL 2: TICKET PASS DETAIL MODAL (ANTI-SCREENSHOT DYNAMIC QR, WHATSAPP, EMAIL, SMS & BLACKLIST) */}
      <TicketPassDetailModal
        pass={inspectedPass}
        displayCurrency={displayCurrency}
        settings={settings}
        currentUserRole={currentUserSession.role}
        onClose={() => setInspectedPass(null)}
        onBlacklistPass={(id, reason) => {
          onBlacklistPass?.(id, reason);
          setInspectedPass((prev) =>
            prev && prev.id === id ? { ...prev, status: 'blacklisted', blacklistReason: reason } : prev
          );
        }}
        onReactivatePass={(id) => {
          onReactivatePass?.(id);
          setInspectedPass((prev) =>
            prev && prev.id === id ? { ...prev, status: 'valid', blacklistReason: undefined } : prev
          );
        }}
      />

      {/* MODAL 3: CREATE EVENT */}
      {isCreateEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-lg rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300 bg-rose-100 text-rose-800">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Créer un Nouvel Événement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configuration des jauges (VIP, Standard, VVIP) et du lieu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateEventOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Titre de l&apos;événement</label>
                <input
                  type="text"
                  required
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  placeholder="Ex: Fally Ipupa Live Concert Arena 2026"
                  className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={evtCategory}
                    onChange={(e) => setEvtCategory(e.target.value as EventCategory)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:border-rose-600 focus:outline-none"
                  >
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date et heure</label>
                  <input
                    type="datetime-local"
                    required
                    value={evtDate}
                    onChange={(e) => setEvtDate(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-mono font-semibold text-slate-800 focus:border-rose-600 focus:outline-none"
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lieu / Salle</label>
                  <input
                    type="text"
                    required
                    value={evtVenue}
                    onChange={(e) => setEvtVenue(e.target.value)}
                    placeholder="Ex: Stade des Martyrs"
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ville</label>
                  <input
                    type="text"
                    required
                    value={evtCity}
                    onChange={(e) => setEvtCity(e.target.value)}
                    placeholder="Kinshasa"
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Tiers Config */}
              <div className="rounded-xl border-2 border-sky-200 bg-sky-50/60 p-3.5 space-y-3">
                <span className="font-bold text-slate-900 uppercase text-[11px] block">
                  Configuration des Tarifs & Jauges
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Standard ($ / Jauge)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={stdPrice}
                        onChange={(e) => setStdPrice(e.target.value)}
                        className="w-1/2 rounded-lg border border-sky-300 bg-white p-1 text-center font-mono font-bold"
                      />
                      <input
                        type="number"
                        value={stdCap}
                        onChange={(e) => setStdCap(e.target.value)}
                        className="w-1/2 rounded-lg border border-sky-300 bg-white p-1 text-center font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">VIP ($ / Jauge)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={vipPrice}
                        onChange={(e) => setVipPrice(e.target.value)}
                        className="w-1/2 rounded-lg border border-sky-300 bg-white p-1 text-center font-mono font-bold text-rose-800"
                      />
                      <input
                        type="number"
                        value={vipCap}
                        onChange={(e) => setVipCap(e.target.value)}
                        className="w-1/2 rounded-lg border border-sky-300 bg-white p-1 text-center font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">VVIP ($ / Jauge)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={vvipPrice}
                        onChange={(e) => setVvipPrice(e.target.value)}
                        className="w-1/2 rounded-lg border border-sky-300 bg-white p-1 text-center font-mono font-bold text-amber-800"
                      />
                      <input
                        type="number"
                        value={vvipCap}
                        onChange={(e) => setVvipCap(e.target.value)}
                        className="w-1/2 rounded-lg border border-sky-300 bg-white p-1 text-center font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsCreateEventOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-2 font-bold text-white hover:bg-rose-800 shadow-xs"
                >
                  Publier l&apos;Événement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: MULTI-TICKET PURCHASE WITH MANDATORY MOBILE MONEY PAYMENT */}
      {buyingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-lg rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4">
              <div>
                <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                  Paiement Mobile Money Obligatoire
                </span>
                <h3 className="mt-1 text-base font-extrabold text-slate-900">
                  {buyingEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBuyingEvent(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* STEP 1: FORM */}
            {checkoutStep === 'form' && (
              <form onSubmit={handleProceedToPayment} className="mt-5 space-y-4 text-xs">
                {/* Category Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    1. Catégorie de billet
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {buyingEvent.tiers.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTier(t.name)}
                        className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                          selectedTier === t.name
                            ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200'
                        }`}
                      >
                        <div className="text-xs font-bold">{t.name}</div>
                        <div className="text-xs font-mono font-bold text-rose-800 mt-0.5">
                          {formatMoney(t.priceUSD, displayCurrency, settings.rates)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity & Promo Code */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      2. Nombre de places
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const n = Math.max(1, ticketQuantity - 1);
                          setTicketQuantity(n);
                          setGuestNames((prev) => prev.slice(0, n));
                        }}
                        className="rounded-lg border-2 border-slate-300 px-3 py-1.5 font-bold hover:bg-slate-100"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-sm text-slate-900 min-w-8 text-center">
                        {ticketQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const n = Math.min(10, ticketQuantity + 1);
                          setTicketQuantity(n);
                          setGuestNames((prev) => {
                            const copy = [...prev];
                            while (copy.length < n) copy.push('');
                            return copy;
                          });
                        }}
                        className="rounded-lg border-2 border-slate-300 px-3 py-1.5 font-bold hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Code Réduction (Optionnel)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        placeholder="Ex: EARLYBIRD"
                        className="w-full rounded-xl border-2 border-sky-200 px-2.5 py-1.5 text-xs font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-50"
                      >
                        Appliquer
                      </button>
                    </div>
                    {promoMessage && (
                      <div className="mt-1 text-[11px] font-semibold text-rose-700">
                        {promoMessage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Buyer info */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    3. Nom et Prénom de l&apos;Acheteur
                  </label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Ex: Grâce Lukunku"
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Téléphone Mobile Money (Réception du Pass QR)
                  </label>
                  <input
                    type="tel"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                {/* Mobile Money Operator Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    4. Opérateur Mobile Money (Requis avant émission QR)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {RAILS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBuyerRail(r)}
                        className={`rounded-xl border-2 p-2 text-xs font-bold transition-all text-center ${
                          buyerRail === r
                            ? 'border-rose-600 bg-rose-700 text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total Summary */}
                {(() => {
                  const tierObj = buyingEvent.tiers.find((t) => t.name === selectedTier);
                  const unitPrice = tierObj ? tierObj.priceUSD : 25;
                  const subtotal = unitPrice * ticketQuantity;
                  const discount = subtotal * (appliedPromoPercent / 100);
                  const finalTotal = subtotal - discount;

                  return (
                    <div className="rounded-xl border-2 border-sky-300 bg-sky-50/70 p-3 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>Sous-total ({ticketQuantity} place(s)) :</span>
                        <span>${subtotal.toFixed(2)} USD</span>
                      </div>
                      {appliedPromoPercent > 0 && (
                        <div className="flex justify-between text-rose-700 font-bold">
                          <span>Remise ({appliedPromoPercent}%) :</span>
                          <span>- ${discount.toFixed(2)} USD</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-slate-900 border-t border-sky-200 pt-1">
                        <span>Total net à débiter :</span>
                        <span className="text-rose-800">
                          {formatMoney(finalTotal, displayCurrency, settings.rates)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-700 py-3 text-xs font-black text-white hover:bg-rose-800 transition-colors shadow-xs"
                >
                  <Lock className="h-4 w-4" />
                  <span>Initier le Paiement {buyerRail} & Obtenir le Pass QR</span>
                </button>
              </form>
            )}

            {/* STEP 2: PROCESSING MOBILE MONEY USSD PUSH */}
            {checkoutStep === 'processing_payment' && (
              <div className="mt-8 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-rose-200 border-t-rose-600 animate-spin" />
                  <Smartphone className="absolute inset-0 m-auto h-7 w-7 text-rose-700" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Demande de Débit Push USSD en cours...
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                    Une notification a été transmise au{' '}
                    <strong className="font-mono text-slate-800">{buyerPhone}</strong> via{' '}
                    <strong className="text-rose-800">{buyerRail}</strong>.
                  </p>
                </div>
                <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-[11px] text-sky-900 font-mono">
                  * Pas de paiement validé = aucun pass émis (Règle stricte anti-fraude)
                </div>
              </div>
            )}

            {/* STEP 3: CONFIRMED & ISSUED */}
            {checkoutStep === 'confirmed' && (
              <div className="mt-6 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    Paiement Validé avec Succès !
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Réf. Transaction :{' '}
                    <strong className="font-mono text-slate-800">{paymentTransactionRef}</strong>
                  </p>
                  <p className="mt-1 text-xs text-emerald-800 font-bold">
                    {generatedPurchasedPasses.length} Pass QR cryptographique(s) généré(s) avec signature HMAC !
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  {generatedPurchasedPasses.map((gp) => (
                    <button
                      key={gp.id}
                      type="button"
                      onClick={() => {
                        setBuyingEvent(null);
                        setInspectedPass(gp);
                      }}
                      className="flex items-center justify-between rounded-xl border-2 border-sky-300 bg-sky-50/70 p-3 text-left hover:bg-sky-100 transition-colors"
                    >
                      <div>
                        <span className="font-mono font-bold text-rose-800 text-xs">{gp.passCode}</span>
                        <div className="text-[11px] font-bold text-slate-800">{gp.holderName}</div>
                      </div>
                      <span className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-bold text-sky-950">
                        Ouvrir Pass QR →
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setBuyingEvent(null)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: ORGANIZER PAYOUT */}
      {payoutEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                  Reversement Promoteur 93%
                </span>
                <h3 className="mt-1 text-sm font-black text-slate-900 truncate max-w-[280px]">
                  {payoutEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPayoutEvent(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestPayoutSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Montant net à virer (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payoutAmountUSD}
                  onChange={(e) => setPayoutAmountUSD(e.target.value)}
                  className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Opérateur de versement</label>
                <select
                  value={payoutRail}
                  onChange={(e) => setPayoutRail(e.target.value as FintechRail)}
                  className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-bold text-slate-800"
                >
                  {RAILS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">N° Mobile Money ou Compte Bénéficiaire</label>
                <input
                  type="text"
                  required
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  placeholder="Ex: +243 81 600 9900 (M-Pesa Marchand)"
                  className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-mono font-semibold text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setPayoutEvent(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-2 font-bold text-white hover:bg-rose-800 shadow-xs"
                >
                  Confirmer le Virement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
