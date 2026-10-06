import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  ExternalLink,
  Flame,
  Layers,
  MapPin,
  MessageSquare,
  Play,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import {
  AccessLogEntry,
  CurrencyCode,
  EventCategory,
  EventTicketPass,
  FintechRail,
  OrganizerPayout,
  StoreSettings,
  TicketingEvent,
} from '../types';
import { formatDateTime, formatMoney } from '../utils/format';
import { playAlertBuzzer, playSuccessChime } from '../utils/audioAlerts';
import { SvgQrCode } from './SvgQrCode';

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
    outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found';
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
}

type SubTab = 'events' | 'passes' | 'scanner' | 'logs' | 'organizers' | 'monetization';
type PassViewMode = 'mobile' | 'badge' | 'thermal';

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
}) => {
  const [subTab, setSubTab] = useState<SubTab>('events');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Create Event Modal state
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtCategory, setEvtCategory] = useState<EventCategory>(
    'Concert & Festival'
  );
  const [evtOrganizer, setEvtOrganizer] = useState('');
  const [evtPhone, setEvtPhone] = useState('+243 ');
  const [evtVenue, setEvtVenue] = useState('');
  const [evtCity, setEvtCity] = useState('Kinshasa');
  const [evtDate, setEvtDate] = useState('2026-11-15T19:00');
  const [stdPrice, setStdPrice] = useState('15');
  const [stdCap, setStdCap] = useState('300');
  const [vipPrice, setVipPrice] = useState('45');
  const [vipCap, setVipCap] = useState('80');
  const [vvipPrice, setVvipPrice] = useState('120');
  const [vvipCap, setVvipCap] = useState('20');

  // Multi-Ticket Purchase Modal state
  const [buyingEvent, setBuyingEvent] = useState<TicketingEvent | null>(null);
  const [selectedTier, setSelectedTier] = useState<'Standard' | 'VIP' | 'VVIP'>('VIP');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoPercent, setAppliedPromoPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('+243 ');
  const [buyerRail, setBuyerRail] = useState<FintechRail>('M-Pesa');
  const [guestNames, setGuestNames] = useState<string[]>(['']);

  // Inspected QR Pass Modal
  const [inspectedPass, setInspectedPass] = useState<EventTicketPass | null>(null);
  const [passViewMode, setPassViewMode] = useState<PassViewMode>('mobile');

  // Scanner state
  const [selectedGate, setSelectedGate] = useState(GATES[0]);
  const [selectedAgent, setSelectedAgent] = useState(SECURITY_AGENTS[0]);
  const [scanInput, setScanInput] = useState('');
  const [isScanningActive, setIsScanningActive] = useState(true);
  const [scanResult, setScanResult] = useState<{
    outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found';
    pass?: EventTicketPass;
    previousCheckIn?: string;
    scannedCode: string;
    gate?: string;
    scannedBy?: string;
  } | null>(null);

  // Passes search & filters
  const [passSearch, setPassSearch] = useState('');
  const [passEventFilter, setPassEventFilter] = useState('all');
  const [passStatusFilter, setPassStatusFilter] = useState<'all' | 'valid' | 'used'>('all');

  // Logs search & filters
  const [logSearch, setLogSearch] = useState('');
  const [logResultFilter, setLogResultFilter] = useState<'all' | 'granted' | 'duplicate_denied' | 'invalid_unknown'>('all');

  // Organizer Payout Modal
  const [payoutEvent, setPayoutEvent] = useState<TicketingEvent | null>(null);
  const [payoutRail, setPayoutRail] = useState<FintechRail>('M-Pesa');
  const [payoutDestination, setPayoutDestination] = useState('');
  const [payoutAmountUSD, setPayoutAmountUSD] = useState('');

  // 12-Month Ticketing Revenue Simulator state
  const [simEventsPerMonth, setSimEventsPerMonth] = useState(12);
  const [simAvgTicketsPerEvent, setSimAvgTicketsPerEvent] = useState(250);
  const [simAvgTicketPriceUSD, setSimAvgTicketPriceUSD] = useState(25);
  const [simCommissionPct, setSimCommissionPct] = useState(7.0);

  // Global metrics across all events & passes
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
    const totalOrganizerPayoutsUSD = organizerPayouts.reduce((acc, p) => acc + p.amountUSD, 0);

    return {
      totalTicketsSold,
      totalGrossUSD,
      totalCommissionUSD,
      checkedInPassesCount,
      totalOrganizerPayoutsUSD,
    };
  }, [events, passes, organizerPayouts]);

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtVenue.trim()) return;
    onCreateEvent({
      title: evtTitle.trim(),
      category: evtCategory,
      organizerName: evtOrganizer.trim() || 'Organisateur Officiel',
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

  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (code === 'EARLYBIRD' || code === 'EARLY10') {
      setAppliedPromoPercent(10);
      setPromoMessage('Code promo EARLYBIRD appliqué : -10%');
    } else if (code === 'VIP2026' || code === 'KOLA15') {
      setAppliedPromoPercent(15);
      setPromoMessage('Code privilège VIP2026 appliqué : -15%');
    } else if (code === 'AFRICA20' || code === 'FESTIVAL20') {
      setAppliedPromoPercent(20);
      setPromoMessage('Code spécial Festival appliqué : -20%');
    } else {
      setAppliedPromoPercent(0);
      setPromoMessage('Code promotionnel non valide');
    }
  };

  const handleBuySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyingEvent || !buyerName.trim()) return;

    const generated = onPurchaseTicketPasses({
      eventId: buyingEvent.id,
      tierName: selectedTier,
      holderName: buyerName.trim(),
      holderPhone: buyerPhone.trim(),
      paymentRail: buyerRail,
      quantity: ticketQuantity,
      discountPercent: appliedPromoPercent,
      guestNames: guestNames.map((g, idx) =>
        g.trim() ? g.trim() : `${buyerName.trim()} (Place #${idx + 1})`
      ),
    });

    setBuyingEvent(null);
    setAppliedPromoPercent(0);
    setPromoCodeInput('');
    setPromoMessage('');
    setTicketQuantity(1);

    if (generated && generated.length > 0) {
      setInspectedPass(generated[0]);
    }
  };

  const triggerScanVerification = (codeToScan: string) => {
    const cleanCode = codeToScan.trim().toUpperCase();
    if (!cleanCode) return;

    const res = onScanTicketPass(cleanCode, selectedGate, selectedAgent);

    if (res.outcome === 'valid_entry') {
      if (soundEnabled) playSuccessChime();
    } else {
      if (soundEnabled) playAlertBuzzer();
    }

    setScanResult({
      ...res,
      scannedCode: cleanCode,
      gate: selectedGate,
      scannedBy: selectedAgent,
    });
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerScanVerification(scanInput);
    setScanInput('');
  };

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

  const handleExportAttendeesCSV = () => {
    const headers = [
      'Code Billet',
      'Signature QR',
      'Participant',
      'Telephone',
      'Evenement',
      'Categorie',
      'Prix Paye USD',
      'Moyen Paiement',
      'Date Achat',
      'Statut Entree',
      'Heure Entree',
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
      `"${p.status === 'used' ? 'DEJA ENTRE' : 'NON SCANNE'}"`,
      `"${p.checkedInAt || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `kolapass_participants_${new Date().toISOString().slice(0, 10)}.csv`
    );
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

  const simMonthlyGrossUSD =
    simEventsPerMonth * simAvgTicketsPerEvent * simAvgTicketPriceUSD;
  const simMonthlyCommissionUSD =
    simMonthlyGrossUSD * (simCommissionPct / 100);
  const simAnnualCommissionUSD = simMonthlyCommissionUSD * 12;

  return (
    <div className="space-y-6">
      {/* Top Banner: Clean unboxed metadata, zero-pill discipline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 tracking-wide uppercase">
              <span>KolaPass Pro</span>
              <span aria-hidden="true">·</span>
              <span>Billetterie Numérique & Contrôle d&apos;Accès QR Code</span>
              <span aria-hidden="true">·</span>
              <span>Commission 7,0%</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
              Guichet Billetterie Mobile Money & Portique Anti-Fraude
            </h1>
            <p className="text-xs text-slate-500 max-w-3xl">
              Vente instantanée par M-Pesa, Orange Money, Airtel Money et Carte bancaire. Pass QR infalsifiables, contrôle par caméra avec alertes sonores et reversements automatiques aux promoteurs.
            </p>
          </div>

          {/* Quick interactive test controls */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => {
                const targetEvent = events[0];
                if (!targetEvent) return;
                setBuyingEvent(targetEvent);
                setSelectedTier('VIP');
                setTicketQuantity(2);
                setBuyerName('David Kabila');
                setBuyerPhone('+243 81 999 0011');
                setBuyerRail('M-Pesa');
                setGuestNames(['David Kabila', 'Sarah Kabila']);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors whitespace-nowrap shadow-2xs"
            >
              <Play className="h-3.5 w-3.5 text-emerald-700" />
              <span>Simuler Achat (2 Pass VIP)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('scanner');
                const validPass = passes.find((p) => p.status === 'valid') || passes[0];
                if (validPass) {
                  setScanInput(validPass.passCode);
                  triggerScanVerification(validPass.passCode);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shadow-2xs"
            >
              <ScanLine className="h-3.5 w-3.5 text-emerald-400" />
              <span>Tester Scanner Caméra</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? 'Désactiver les signaux sonores' : 'Activer les signaux sonores'}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[11px]">Son ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">Son OFF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clean Segmented Subtab Navigation */}
        <div className="mt-5 border-t border-slate-100 pt-4 flex flex-wrap items-center gap-1.5">
          {[
            { id: 'events', label: 'Événements & Vente', count: events.length },
            { id: 'passes', label: 'Billets & Pass Émis', count: passes.length },
            { id: 'scanner', label: 'Portique Caméra', highlight: true },
            { id: 'logs', label: 'Journal des Scans', count: accessLogs.length },
            { id: 'organizers', label: 'Reversements Promoteurs' },
            { id: 'monetization', label: 'Rentabilité Annuelle' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as SubTab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                subTab === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    subTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.highlight && subTab !== tab.id && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            Recettes Brutes Billetterie
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatMoney(metrics.totalGrossUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.totalTicketsSold.toLocaleString('fr-FR')} billet(s) écoulé(s)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            Commissions KolaPass (7,0%)
          </span>
          <div className="mt-1 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            +{formatMoney(metrics.totalCommissionUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Revenu net prélevé à la source sur chaque transaction
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            Dû Net aux Promoteurs (93%)
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatMoney(metrics.totalGrossUSD - metrics.totalCommissionUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {formatMoney(metrics.totalOrganizerPayoutsUSD, displayCurrency, settings.rates)} déjà virés
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            Taux d&apos;Émargement Portique
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.checkedInPassesCount} / {passes.length} entrées
          </div>
          <p className="mt-1 text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Contrôle anti-doublon temps réel actif
          </p>
        </div>
      </div>

      {/* SUBTAB 1: EVENTS CATALOG & TICKET BOX OFFICE */}
      {subTab === 'events' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Événements à l&apos;Affiche & Billetterie Officielle
              </h2>
              <p className="text-xs text-slate-500">
                Chaque billet réservé génère instantanément un Pass QR Code infalsifiable prêt pour WhatsApp et le contrôle portique.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateEventOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap self-start sm:self-auto shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Créer un Nouvel Événement</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                >
                  {/* Card Header with Poster Date Badge */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="text-xs font-semibold text-emerald-800 tracking-wide uppercase">
                          {ev.category}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 leading-snug" style={{ textWrap: 'balance' }}>
                          {ev.title}
                        </h3>
                      </div>

                      {/* Date Stamp Block */}
                      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-center shrink-0">
                        <span className="text-base font-bold text-slate-900 leading-none">{dayNum}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight mt-0.5">{monthStr}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono tabular-nums">{formatDateTime(ev.eventDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{ev.venue} ({ev.city})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Promoteur : {ev.organizerName}</span>
                      </div>
                    </div>

                    {/* Progress Bar of Capacity */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-500">
                        <span>Places écoulées</span>
                        <span className="font-bold text-slate-800">{fillPct}% ({totalSold}/{totalCap})</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillPct > 85 ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Tiers Pricing Grid */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                        <span>Catégorie</span>
                        <span>Tarif</span>
                        <span>Dispo</span>
                      </div>
                      {ev.tiers.map((t) => (
                        <div key={t.id} className="flex items-center justify-between border-t border-slate-200/60 pt-1">
                          <span className="font-sans font-semibold text-slate-800">{t.name}</span>
                          <span className="font-bold text-slate-900">{formatMoney(t.priceUSD, displayCurrency, settings.rates)}</span>
                          <span className="text-slate-500">{t.sold}/{t.capacity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Bottom CTA & Commission Breakdown */}
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-sans text-slate-500">Votre commission ({ev.commissionRatePercent}%) :</span>
                      <span className="font-bold text-emerald-700">+{formatMoney(myCommissionUSD, displayCurrency, settings.rates)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBuyingEvent(ev);
                          setSelectedTier('Standard');
                          setTicketQuantity(1);
                          setBuyerName('');
                          setBuyerPhone('+243 ');
                          setGuestNames(['']);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 px-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        <span>Acheter Billet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayoutEvent(ev);
                          setPayoutAmountUSD((eventRevenueUSD * 0.93).toFixed(2));
                          setPayoutDestination(ev.organizerPhone);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                        <span>Reversement</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: ISSUED TICKETS & PASSES */}
      {subTab === 'passes' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={passSearch}
                  onChange={(e) => setPassSearch(e.target.value)}
                  placeholder="Rechercher par code Pass (PASS-KOLA-...), participant ou événement..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Event filter */}
              <select
                aria-label="Filtrer les billets par événement"
                value={passEventFilter}
                onChange={(e) => setPassEventFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
              >
                <option value="all">Tous les événements</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                aria-label="Filtrer les billets par statut d'entrée"
                value={passStatusFilter}
                onChange={(e) => setPassStatusFilter(e.target.value as 'all' | 'valid' | 'used')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
              >
                <option value="all">Tous les statuts</option>
                <option value="valid">Valide (Non scanné)</option>
                <option value="used">Déjà entré (Scanné)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportAttendeesCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs self-start lg:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Exporter CSV ({filteredPasses.length})</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Billet QR & Signature</th>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Événement & Catégorie</th>
                    <th className="py-3 px-4 text-right">Prix Payé</th>
                    <th className="py-3 px-4 text-right">Statut Portique</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPasses.map((pass) => (
                    <tr key={pass.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <QrCode className="h-3.5 w-3.5 text-slate-500" />
                          <span>{pass.passCode}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{pass.qrSignature}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{pass.holderName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {pass.holderPhone} · {pass.paymentRail}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{pass.eventTitle}</div>
                        <div className="text-[11px] text-slate-500">
                          Accès <strong>{pass.tierName}</strong> · {pass.venue}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatMoney(pass.pricePaidUSD, displayCurrency, settings.rates)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {pass.status === 'valid' ? (
                          <span className="inline-flex items-center gap-1 font-sans font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Valide (Non scanné)
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 font-sans font-semibold text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Déjà entré ({pass.scanAttempts} scan)
                            </span>
                            {pass.checkedInAt && (
                              <div className="text-[10px] text-slate-400">
                                {formatDateTime(pass.checkedInAt)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedPass(pass);
                              setPassViewMode('mobile');
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shadow-2xs"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>Voir Pass</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('scanner');
                              setScanInput(pass.passCode);
                              triggerScanVerification(pass.passCode);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shadow-2xs"
                          >
                            <ScanLine className="h-3.5 w-3.5" />
                            <span>Scanner</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPasses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        Aucun billet trouvé pour ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: ACCESS CONTROL PORTAL & CAMERA SCANNER */}
      {subTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Viewfinder & Verification Results */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-emerald-600" />
                  <span>Portique Caméra & Filtrage d&apos;Entrée</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Détection instantanée, vérification anti-fraude et signaux sonores synchronisés.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsScanningActive((prev) => !prev)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  isScanningActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isScanningActive ? 'Caméra Active' : 'En Pause'}
              </button>
            </div>

            {/* Operator and Gate selectors */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Point d&apos;Accès Portique
                </label>
                <select
                  value={selectedGate}
                  onChange={(e) => setSelectedGate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 font-medium"
                >
                  {GATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Agent de Sécurité en Poste
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 font-medium"
                >
                  {SECURITY_AGENTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Simulated Live Camera HUD */}
            <div className="relative aspect-video w-full rounded-xl bg-slate-950 overflow-hidden border-2 border-slate-800 shadow-inner flex items-center justify-center">
              {/* Animated Laser Scanning Line */}
              {isScanningActive && (
                <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-bounce" />
              )}

              {/* Viewfinder Target Corner Brackets */}
              <div className="pointer-events-none absolute h-36 w-36 border-2 border-dashed border-emerald-400/60 rounded-xl flex items-center justify-center">
                <QrCode className="h-14 w-14 text-emerald-400/25" />
              </div>

              {/* Top HUD info */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/80 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  KOLAPASS SCANNER HUD
                </span>
                <span>{selectedGate}</span>
              </div>

              {/* Bottom HUD info */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-[10px] text-white/60 font-mono">
                <span>{selectedAgent}</span>
                <span>Signal sonore : {soundEnabled ? 'ACTIF' : 'MUET'}</span>
              </div>
            </div>

            {/* Manual Code Input Form */}
            <form onSubmit={handleManualScanSubmit} className="flex gap-2">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Entrez un code Pass (Ex: PASS-KOLA-8821)"
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase text-slate-900 focus:border-slate-900 focus:outline-none shadow-2xs"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shadow-2xs"
              >
                <ScanLine className="h-4 w-4 text-emerald-400" />
                <span>Contrôler le Billet</span>
              </button>
            </form>

            {/* Verification Result Display */}
            {scanResult && (
              <div
                className={`rounded-xl border p-5 space-y-3 ${
                  scanResult.outcome === 'valid_entry'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-red-300 bg-red-50 text-red-950'
                }`}
              >
                {scanResult.outcome === 'valid_entry' && scanResult.pass && (
                  <>
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-sm font-bold uppercase tracking-wide">
                          ACCÈS AUTORISÉ — BILLET AUTHENTIQUE VALIDÉ
                        </div>
                        <div className="text-xs text-emerald-800 font-mono">
                          Code : {scanResult.pass.passCode} · {scanResult.pass.qrSignature}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/95 p-3.5 text-xs space-y-1.5 border border-emerald-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Participant :</span>
                        <span className="font-bold text-slate-900">{scanResult.pass.holderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Zone d&apos;accès :</span>
                        <span className="font-bold text-emerald-700">CATÉGORIE {scanResult.pass.tierName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Événement :</span>
                        <span className="font-medium text-slate-800">{scanResult.pass.eventTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Point de contrôle :</span>
                        <span className="font-mono text-slate-600">{scanResult.gate} · {scanResult.scannedBy}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => triggerScanVerification(scanResult.scannedCode)}
                      className="w-full rounded-lg border border-emerald-700 bg-white py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs"
                    >
                      Simuler un 2e passage immédiat avec ce même billet (Test Alerte Doublon)
                    </button>
                  </>
                )}

                {scanResult.outcome === 'fraud_duplicate' && scanResult.pass && (
                  <>
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
                      <div>
                        <div className="text-sm font-bold uppercase text-red-900 tracking-wide">
                          ENTRÉE REFUSÉE — ALERTE BILLET DÉJÀ SCANNÉ !
                        </div>
                        <div className="text-xs text-red-700 font-mono">
                          Tentative n°{scanResult.pass.scanAttempts} détectée sur {scanResult.pass.passCode}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/95 p-3.5 text-xs space-y-1.5 border border-red-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Titulaire d&apos;origine :</span>
                        <span className="font-bold text-slate-900">
                          {scanResult.pass.holderName} ({scanResult.pass.tierName})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">1ère entrée enregistrée :</span>
                        <span className="font-mono font-bold text-red-700">
                          {formatDateTime(scanResult.previousCheckIn || scanResult.pass.checkedInAt || '')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Porte de la tentative :</span>
                        <span className="font-mono text-slate-700">{scanResult.gate}</span>
                      </div>
                    </div>
                  </>
                )}

                {scanResult.outcome === 'not_found' && (
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    <div className="text-xs font-semibold">
                      Code QR inconnu ({scanResult.scannedCode}). Aucun billet officiel ne correspond à cette référence.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Quick Test Bench */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Banc d&apos;Essai Rapide (Cliquez sur un billet pour le scanner)
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {passes.length} billets disponibles
              </span>
            </div>

            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {passes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5 text-xs hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="font-mono font-bold text-slate-900">
                      {p.passCode} —{' '}
                      <span className="font-sans font-semibold text-slate-800">{p.holderName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {p.tierName} · {p.eventTitle}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[11px] font-semibold ${
                        p.status === 'valid' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {p.status === 'valid' ? 'Valide' : 'Déjà entré'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setScanInput(p.passCode);
                        triggerScanVerification(p.passCode);
                      }}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shadow-2xs"
                    >
                      Scanner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ACCESS CONTROL LOGS & AUDIT TRAIL */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Rechercher dans le journal (Code, participant, porte, agent...)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <select
                aria-label="Filtrer les journaux de scan par résultat"
                value={logResultFilter}
                onChange={(e) => setLogResultFilter(e.target.value as 'all' | 'granted' | 'duplicate_denied' | 'invalid_unknown')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
              >
                <option value="all">Tous les résultats</option>
                <option value="granted">Autorisé (Valide)</option>
                <option value="duplicate_denied">Refusé (Doublon)</option>
                <option value="invalid_unknown">Inconnu / Invalide</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onClearAccessLogs}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs self-start sm:self-auto"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Effacer le Journal</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Heure du Scan</th>
                    <th className="py-3 px-4">Billet & Participant</th>
                    <th className="py-3 px-4">Porte & Agent</th>
                    <th className="py-3 px-4">Résultat Décision</th>
                    <th className="py-3 px-4">Notes de Contrôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{log.passCode}</div>
                        <div className="text-[11px] text-slate-600">
                          {log.holderName} {log.tierName !== 'N/A' && `(${log.tierName})`}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{log.gate}</div>
                        <div className="text-[11px] text-slate-500">{log.scannedBy}</div>
                      </td>
                      <td className="py-3 px-4">
                        {log.result === 'granted' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Entrée Autorisée
                          </span>
                        )}
                        {log.result === 'duplicate_denied' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Refusé (Doublon Fraude)
                          </span>
                        )}
                        {log.result === 'invalid_unknown' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Billet Inconnu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {log.notes || '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        Aucun enregistrement de contrôle pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: ORGANIZERS REVENUE & PAYOUTS */}
      {subTab === 'organizers' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900">
              Espace Promoteurs & Reversements Financiers Automatisés
            </h2>
            <p className="text-xs text-slate-500">
              Les organisateurs touchent 93% des recettes nettes des ventes par Mobile Money ou Virement Bancaire instantané.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {events.map((ev) => {
              const eventGrossUSD = ev.tiers.reduce((acc, t) => acc + t.sold * t.priceUSD, 0);
              const eventCommissionUSD = eventGrossUSD * (ev.commissionRatePercent / 100);
              const netOrganizerUSD = eventGrossUSD - eventCommissionUSD;

              const paidToEventUSD = organizerPayouts
                .filter((p) => p.eventId === ev.id)
                .reduce((acc, p) => acc + p.amountUSD, 0);

              const remainingToPayUSD = Math.max(0, netOrganizerUSD - paidToEventUSD);

              return (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                        {ev.category}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Promoteur : {ev.organizerName} ({ev.organizerPhone})
                      </p>
                    </div>

                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-mono font-semibold text-slate-700">
                      {ev.code}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-600">Recette Brute Billetterie :</span>
                      <span className="font-bold text-slate-900">{formatMoney(eventGrossUSD, displayCurrency, settings.rates)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-600">Commission KolaPass (7%) :</span>
                      <span className="font-bold text-emerald-700">- {formatMoney(eventCommissionUSD, displayCurrency, settings.rates)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                      <span className="font-sans text-slate-900">Dû Total Promoteur (93%) :</span>
                      <span className="text-slate-900">{formatMoney(netOrganizerUSD, displayCurrency, settings.rates)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="font-sans">Déjà versé :</span>
                      <span>{formatMoney(paidToEventUSD, displayCurrency, settings.rates)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-bold border-t border-slate-200 pt-1.5">
                      <span className="font-sans">Solde disponible :</span>
                      <span>{formatMoney(remainingToPayUSD, displayCurrency, settings.rates)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={remainingToPayUSD <= 0}
                    onClick={() => {
                      setPayoutEvent(ev);
                      setPayoutAmountUSD(remainingToPayUSD.toFixed(2));
                      setPayoutDestination(ev.organizerPhone);
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-semibold transition-colors shadow-2xs ${
                      remainingToPayUSD > 0
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    <span>Effectuer le Virement Promoteur</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Reversements Historique Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              Historique des Reversements Effectués aux Promoteurs
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Événement</th>
                    <th className="py-2.5">Bénéficiaire / Compte</th>
                    <th className="py-2.5">Moyen</th>
                    <th className="py-2.5 text-right">Montant Reversé</th>
                    <th className="py-2.5 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizerPayouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-mono text-slate-500">
                        {formatDateTime(p.requestedAt)}
                      </td>
                      <td className="py-2.5 font-medium text-slate-900">
                        {p.eventTitle}
                      </td>
                      <td className="py-2.5 font-mono text-slate-600">
                        {p.destinationAccount} ({p.organizerName})
                      </td>
                      <td className="py-2.5 font-medium text-slate-800">
                        {p.paymentRail}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-700">
                        {formatMoney(p.amountUSD, displayCurrency, settings.rates)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Effectué
                        </span>
                      </td>
                    </tr>
                  ))}
                  {organizerPayouts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Aucun reversement encore enregistré.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: REVENUE SIMULATOR (12 MONTHS) */}
      {subTab === 'monetization' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6 shadow-2xs">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">
              Simulateur de Rentabilité Billetterie KolaPass sur 12 Mois
            </h2>
            <p className="text-xs text-slate-500">
              Ajustez le volume d&apos;événements pour calculer vos gains récurrents en tant qu&apos;opérateur de plateforme.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-800">
                    Événements hébergés par mois
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {simEventsPerMonth} événements / mois
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={60}
                  value={simEventsPerMonth}
                  onChange={(e) => setSimEventsPerMonth(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-800">
                    Moyenne de billets vendus par événement
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {simAvgTicketsPerEvent} participants
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={2000}
                  step={50}
                  value={simAvgTicketsPerEvent}
                  onChange={(e) => setSimAvgTicketsPerEvent(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-800">
                    Prix moyen d&apos;un billet (USD)
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    ${simAvgTicketPriceUSD} USD
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={simAvgTicketPriceUSD}
                  onChange={(e) => setSimAvgTicketPriceUSD(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-800">
                    Votre commission par billet vendu (%)
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {simCommissionPct.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={0.5}
                  value={simCommissionPct}
                  onChange={(e) => setSimCommissionPct(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3 font-mono tabular-nums">
              <div className="text-xs font-sans font-semibold text-slate-700">
                Projections Financières KolaPass
              </div>
              <div className="flex justify-between text-xs border-b border-slate-200 pb-2">
                <span className="font-sans text-slate-600">Volume Billets Mensuel :</span>
                <span className="font-semibold text-slate-900">
                  ${simMonthlyGrossUSD.toLocaleString('fr-FR')} / mois
                </span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-200 pb-2">
                <span className="font-sans text-slate-600">Vos Commissions Mensuelles :</span>
                <span className="text-base font-bold text-slate-900">
                  ${simMonthlyCommissionUSD.toLocaleString('fr-FR')} / mois
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-sans text-xs font-bold text-slate-900">
                  Vos Revenus sur 1 An (12 mois) :
                </span>
                <span className="text-2xl font-bold text-emerald-700">
                  ${simAnnualCommissionUSD.toLocaleString('fr-FR')} / an
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Event */}
      {isCreateEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900">
                Publier un Nouvel Événement sur KolaPass
              </h3>
              <button
                onClick={() => setIsCreateEventOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEventSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Titre de l&apos;événement
                </label>
                <input
                  type="text"
                  required
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  placeholder="Ex: Gala des Entrepreneurs & Investisseurs 2026"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={evtCategory}
                    onChange={(e) => setEvtCategory(e.target.value as EventCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date & Heure
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={evtDate}
                    onChange={(e) => setEvtDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lieu / Salle
                  </label>
                  <input
                    type="text"
                    required
                    value={evtVenue}
                    onChange={(e) => setEvtVenue(e.target.value)}
                    placeholder="Ex: Fleuve Congo Hôtel"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organisateur
                  </label>
                  <input
                    type="text"
                    required
                    value={evtOrganizer}
                    onChange={(e) => setEvtOrganizer(e.target.value)}
                    placeholder="Ex: Agence Prestige Events"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tarif Standard ($)
                  </label>
                  <input
                    type="number"
                    value={stdPrice}
                    onChange={(e) => setStdPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tarif VIP ($)
                  </label>
                  <input
                    type="number"
                    value={vipPrice}
                    onChange={(e) => setVipPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tarif VVIP ($)
                  </label>
                  <input
                    type="number"
                    value={vvipPrice}
                    onChange={(e) => setVvipPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateEventOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Publier l&apos;événement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Multi-Ticket Purchase & Promo Codes */}
      {buyingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  Guichet Billetterie Officiel KolaPass
                </div>
                <div className="text-[11px] text-slate-300 truncate max-w-[320px]">
                  {buyingEvent.title}
                </div>
              </div>
              <button
                onClick={() => setBuyingEvent(null)}
                className="rounded-lg p-1 text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBuySubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* Category selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  1. Choisir la catégorie de place
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {buyingEvent.tiers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTier(t.name)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        selectedTier === t.name
                          ? 'border-emerald-600 bg-emerald-50 text-slate-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{t.name}</div>
                      <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                        {formatMoney(t.priceUSD, displayCurrency, settings.rates)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Selector & Promo Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    2. Nombre de places
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newQ = Math.max(1, ticketQuantity - 1);
                        setTicketQuantity(newQ);
                        setGuestNames((prev) => prev.slice(0, newQ));
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1.5 font-bold hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-sm text-slate-900 min-w-8 text-center">
                      {ticketQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ = Math.min(10, ticketQuantity + 1);
                        setTicketQuantity(newQ);
                        setGuestNames((prev) => {
                          const copy = [...prev];
                          while (copy.length < newQ) {
                            copy.push('');
                          }
                          return copy;
                        });
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1.5 font-bold hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Code Promo (ex: EARLYBIRD)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      placeholder="EARLYBIRD (-10%)"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                    >
                      OK
                    </button>
                  </div>
                  {promoMessage && (
                    <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                      {promoMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* Buyer info */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Titulaire principal du compte
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Ex: Grâce Lukunku"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Téléphone WhatsApp (pour réception des Pass QR)
                </label>
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 shadow-2xs"
                />
              </div>

              {/* Additional guest names if quantity > 1 */}
              {ticketQuantity > 1 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Noms des participants ({ticketQuantity} billets)
                  </label>
                  {Array.from({ length: ticketQuantity }).map((_, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={guestNames[idx] || ''}
                      onChange={(e) => {
                        const copy = [...guestNames];
                        copy[idx] = e.target.value;
                        setGuestNames(copy);
                      }}
                      placeholder={`Participant #${idx + 1} ${idx === 0 ? `(Principal : ${buyerName || ''})` : ''}`}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
                    />
                  ))}
                </div>
              )}

              {/* Payment rail */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  4. Mode de règlement
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {RAILS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBuyerRail(r)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-semibold truncate ${
                        buyerRail === r
                          ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price summary */}
              {(() => {
                const tierObj = buyingEvent.tiers.find((t) => t.name === selectedTier);
                const unitPrice = tierObj ? tierObj.priceUSD : 25;
                const subtotal = unitPrice * ticketQuantity;
                const discount = subtotal * (appliedPromoPercent / 100);
                const finalTotal = subtotal - discount;

                return (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Sous-total ({ticketQuantity}x place {selectedTier}) :</span>
                      <span>${subtotal.toFixed(2)} USD</span>
                    </div>
                    {appliedPromoPercent > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Réduction ({appliedPromoPercent}%) :</span>
                        <span>- ${discount.toFixed(2)} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-emerald-200 pt-1">
                      <span>Total à payer :</span>
                      <span className="text-emerald-800">
                        {formatMoney(finalTotal, displayCurrency, settings.rates)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-600 py-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
              >
                Confirmer l&apos;Achat & Générer {ticketQuantity} Pass QR Code
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Realistic Pass Inspector (Mobile Wallet, VIP Lanyard A6, 80mm Thermal) */}
      {inspectedPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pass Officiel KolaPass Authentifié
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {inspectedPass.passCode} · Accès {inspectedPass.tierName}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Switch view mode */}
                <div className="flex items-center rounded-lg bg-slate-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPassViewMode('mobile')}
                    className={`rounded px-2 py-1 font-semibold ${
                      passViewMode === 'mobile' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassViewMode('badge')}
                    className={`rounded px-2 py-1 font-semibold ${
                      passViewMode === 'badge' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    Badge A6
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassViewMode('thermal')}
                    className={`rounded px-2 py-1 font-semibold ${
                      passViewMode === 'thermal' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    Ticket 80mm
                  </button>
                </div>

                <button
                  onClick={() => setInspectedPass(null)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Pass Container */}
            <div className="p-6 bg-slate-100 overflow-y-auto flex justify-center">
              {/* FORMAT 1: MOBILE PASS (APPLE/GOOGLE WALLET STYLE) */}
              {passViewMode === 'mobile' && (
                <div
                  id="printable-receipt"
                  className="w-full max-w-sm rounded-2xl border border-slate-300 bg-white p-5 shadow-xs space-y-4 font-mono tabular-nums relative overflow-hidden"
                >
                  {/* Subtle perforated side notch cues */}
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 border border-slate-300" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 border border-slate-300" />

                  <div className="border-b border-dashed border-slate-300 pb-3 text-center">
                    <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-700">
                      KOLAPASS — BILLET D&apos;ENTRÉE OFFICIEL
                    </div>
                    <div className="mt-1 text-sm font-sans font-bold text-slate-900">
                      {inspectedPass.eventTitle}
                    </div>
                    <div className="mt-1 text-[11px] font-sans text-slate-600">
                      {inspectedPass.venue}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDateTime(inspectedPass.eventDate)}
                    </div>
                  </div>

                  {/* SVG Crisp QR Code */}
                  <div className="flex flex-col items-center justify-center py-1">
                    <SvgQrCode
                      value={inspectedPass.passCode}
                      size={144}
                      label={inspectedPass.passCode}
                    />
                    <div className="mt-1 text-[10px] text-slate-400 font-mono">
                      {inspectedPass.qrSignature}
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Participant :</span>
                      <span className="font-sans font-bold text-slate-900">
                        {inspectedPass.holderName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Catégorie :</span>
                      <span className="font-bold text-emerald-700">
                        ACCÈS {inspectedPass.tierName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Paiement :</span>
                      <span className="font-bold text-slate-900">
                        {inspectedPass.paymentRail} · {formatMoney(inspectedPass.pricePaidUSD, displayCurrency, settings.rates)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* FORMAT 2: BADGE TOUR DE COU / VIP LANYARD A6 */}
              {passViewMode === 'badge' && (
                <div
                  id="printable-receipt"
                  className="w-full max-w-xs rounded-xl border-2 border-slate-900 bg-white p-6 shadow-sm space-y-4 text-center font-sans"
                >
                  {/* Lanyard Hole Punch slot simulation */}
                  <div className="mx-auto h-2 w-12 rounded-full border border-slate-400 bg-slate-200" />

                  {/* Tier Ribbon */}
                  <div
                    className={`py-1 text-xs font-black tracking-widest uppercase rounded ${
                      inspectedPass.tierName === 'VVIP'
                        ? 'bg-amber-500 text-black'
                        : inspectedPass.tierName === 'VIP'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    ACCÈS {inspectedPass.tierName}
                  </div>

                  <div className="space-y-1">
                    <div className="text-lg font-black text-slate-900 leading-tight">
                      {inspectedPass.holderName}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600">
                      {inspectedPass.eventTitle}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {inspectedPass.venue}
                    </div>
                  </div>

                  {/* High Contrast QR Code */}
                  <div className="flex justify-center py-2">
                    <SvgQrCode value={inspectedPass.passCode} size={150} />
                  </div>

                  <div className="border-t border-slate-200 pt-3 text-[10px] font-mono text-slate-500">
                    <div className="font-bold text-slate-800">{inspectedPass.passCode}</div>
                    <div>Porte d&apos;accès : VIP & Invitations</div>
                  </div>
                </div>
              )}

              {/* FORMAT 3: TICKET CAISSE THERMIQUE 80MM */}
              {passViewMode === 'thermal' && (
                <div
                  id="printable-receipt"
                  className="w-72 rounded-sm border border-slate-300 bg-white p-4 shadow-2xs font-mono text-xs text-slate-900 space-y-3"
                >
                  <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                    <div className="font-bold uppercase tracking-wider">KOLAPASS GUICHET</div>
                    <div className="text-[11px]">{inspectedPass.eventTitle}</div>
                    <div className="text-[10px] text-slate-500">{formatDateTime(inspectedPass.eventDate)}</div>
                  </div>

                  <div className="flex justify-center py-1">
                    <SvgQrCode value={inspectedPass.passCode} size={120} label={inspectedPass.passCode} />
                  </div>

                  <div className="space-y-1 text-[11px] border-t border-dashed border-slate-400 pt-2">
                    <div className="flex justify-between">
                      <span>Bénéficiaire:</span>
                      <span className="font-bold">{inspectedPass.holderName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Place:</span>
                      <span className="font-bold">CAT. {inspectedPass.tierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarif payé:</span>
                      <span className="font-bold">{formatMoney(inspectedPass.pricePaidUSD, displayCurrency, settings.rates)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Règlement:</span>
                      <span>{inspectedPass.paymentRail}</span>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-slate-500 border-t border-dashed border-slate-400 pt-2">
                    Présentez ce reçu au scanner à l&apos;entrée.
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
              <a
                href={`https://wa.me/${inspectedPass.holderPhone.replace(
                  /[^0-9]/g,
                  ''
                )}?text=${encodeURIComponent(
                  `Bonjour ${inspectedPass.holderName}, voici votre Pass officiel *${inspectedPass.passCode}* (Accès ${inspectedPass.tierName}) pour *${inspectedPass.eventTitle}* à ${inspectedPass.venue}. Présentez ce code à l'entrée.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Envoyer sur WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimer le Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Request Organizer Payout */}
      {payoutEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Ordre de Reversement Promoteur
                </h3>
                <div className="text-[11px] text-slate-300 truncate max-w-[280px]">
                  {payoutEvent.title}
                </div>
              </div>
              <button
                onClick={() => setPayoutEvent(null)}
                className="rounded-lg p-1 text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestPayoutSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Montant à virer (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payoutAmountUSD}
                  onChange={(e) => setPayoutAmountUSD(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Moyen de paiement bénéficiaire
                </label>
                <select
                  value={payoutRail}
                  onChange={(e) => setPayoutRail(e.target.value as FintechRail)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium"
                >
                  {RAILS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Compte / N° Téléphone du Bénéficiaire
                </label>
                <input
                  type="text"
                  required
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  placeholder="Ex: +243 81 600 9900 (M-Pesa Compte Marchand)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-slate-500 text-[11px]">
                * Reversement instantané sécurisé avec enregistrement dans l&apos;audit financier KolaPass.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayoutEvent(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
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
