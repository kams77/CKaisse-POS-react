import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  CameraOff,
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
  Barcode,
  Scissors,
  Video,
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
  TicketBatchRange,
  TicketingEvent,
  UserRole,
  UserSession,
} from '../types';
import { formatDateTime, formatMoney, initialsAvatar } from '../utils/format';
import {
  playAlertBuzzer,
  playBlacklistAlarm,
  playSuccessChime,
} from '../utils/audioAlerts';
import { SvgQrCode } from './SvgQrCode';
import { TicketPassDetailModal } from './TicketPassDetailModal';
import { BuyerPortalView } from './BuyerPortalView';
import { TicketBatchModal } from './TicketBatchModal';
import { TicketBatchPrintModal } from './TicketBatchPrintModal';
import { INITIAL_USER_SESSIONS } from '../data/initialData';

export type SubTab =
  | 'events'
  | 'batches'
  | 'passes'
  | 'scanner'
  | 'logs'
  | 'organizers'
  | 'monetization'
  | 'buyer';

interface TicketingProjectViewProps {
  events: TicketingEvent[];
  passes: EventTicketPass[];
  batches?: TicketBatchRange[];
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
    commissionRatePercent?: number;
    ownerId?: string;
  }) => TicketingEvent | Promise<TicketingEvent>;
  onPurchaseTicketPasses: (payload: {
    eventId: string;
    tierName: 'Standard' | 'VIP' | 'VVIP';
    holderName: string;
    holderPhone: string;
    paymentRail: FintechRail;
    quantity?: number;
    discountPercent?: number;
    promoCode?: string;
    guestNames?: string[];
  }) => EventTicketPass[] | Promise<EventTicketPass[]>;
  onGenerateBatch?: (payload: {
    eventId: string;
    tierName: 'Standard' | 'VIP' | 'VVIP';
    name: string;
    prefix: string;
    startNumber: number;
    endNumber: number;
    unitPriceUSD: number;
    generatedBy: string;
    distributorName?: string;
    distributorPhone?: string;
    notes?: string;
  }) => { batch: TicketBatchRange; passes: EventTicketPass[] } | Promise<{ batch: TicketBatchRange; passes: EventTicketPass[] }>;
  /** Validation au portique (par le serveur). `scanned` = contenu brut du QR ou code saisi. */
  onScanTicketPass: (
    scanned: string,
    gate?: string,
    eventId?: string
  ) => ScanOutcome | Promise<ScanOutcome>;
  onRequestOrganizerPayout: (payload: {
    eventId: string;
    amountUSD: number;
    paymentRail: FintechRail;
    destinationAccount: string;
  }) => void;
  onClearAccessLogs?: () => void;
  activeSubTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  currentUserSession?: UserSession;
  onUpdateUserSession?: (session: UserSession) => void;
  onBlacklistPass?: (passId: string, reason: string) => void;
  onReactivatePass?: (passId: string) => void;
  onSyncOfflineScans?: (scans: OfflineScanItem[]) => void | Promise<void>;
  /** Ouvre le menu du compte connecté (remplace l'ancienne fenêtre de changement de rôle). */
  onOpenAccount?: () => void;
  /** Codes promo actifs définis par l'administrateur (vérifiés aussi par le serveur). */
  promoCodes?: Array<{ code: string; percent: number; active?: boolean }>;
  /** Remise manuelle maximale autorisée pour l'utilisateur connecté. */
  maxDiscountPercent?: number;
  /** Portiques configurés par l'administrateur. */
  gates?: string[];
  /** Organisateurs (administrateur uniquement) : à qui rattacher un nouvel événement. */
  organizers?: Array<{ id: string; name: string; phone?: string }>;
}

export interface ScanOutcome {
  outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found' | 'blacklisted';
  pass?: EventTicketPass;
  previousCheckIn?: string;
  wrongEvent?: boolean;
}

/** Code du billet contenu dans ce qui a été scanné (QR JSON signé, code seul ou code#suffixe). */
export function extractPassCode(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s);
      if (o && typeof o.code === 'string') return o.code.trim().toUpperCase();
    } catch { /* texte libre */ }
  }
  return s.split('#')[0].trim().toUpperCase();
}

const OFFLINE_QUEUE_KEY = 'kolapass_offline_queue_v1';
const OFFLINE_USED_KEY = 'kolapass_offline_used_v1';
const readLocal = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};

const EVENT_CATEGORIES: EventCategory[] = [
  'Concert & Festival',
  'Conférence & Business',
  'Formation & Masterclass',
  'Sport & Match',
  'Soirée & Gala',
];

const RAILS: FintechRail[] = [
  'Espèces',
  'M-Pesa',
  'Orange Money',
  'Airtel Money',
  'Wave',
  'MTN MoMo',
  'Visa / Mastercard',
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
  onGenerateBatch,
  onScanTicketPass,
  onRequestOrganizerPayout,
  onClearAccessLogs,
  batches = [],
  activeSubTab,
  onSubTabChange,
  currentUserSession = INITIAL_USER_SESSIONS.admin,
  onUpdateUserSession,
  onBlacklistPass,
  onReactivatePass,
  onSyncOfflineScans,
  onOpenAccount,
  promoCodes = [],
  maxDiscountPercent = 0,
  gates: configuredGates = ['Entrée principale'],
  organizers,
}) => {
  const role = currentUserSession.role;
  const canManage = role === 'admin' || role === 'organizer';
  const [internalSubTab, setInternalSubTab] = useState<SubTab>('events');
  const subTab = activeSubTab !== undefined ? activeSubTab : internalSubTab;
  const setSubTab = (tab: SubTab) => {
    setInternalSubTab(tab);
    onSubTabChange?.(tab);
  };
  const [soundEnabled, setSoundEnabled] = useState(true);


  // Offline Mode (Stade sans réseau) — la file des scans est conservée sur le poste
  // (rechargement, coupure) jusqu'à la synchronisation.
  const [isOfflineMode, setIsOfflineMode] = useState(() => readLocal<OfflineScanItem[]>(OFFLINE_QUEUE_KEY, []).length > 0);
  const [offlineScansQueue, setOfflineScansQueue] = useState<OfflineScanItem[]>(() => readLocal(OFFLINE_QUEUE_KEY, []));
  const [offlineUsedCodes, setOfflineUsedCodes] = useState<string[]>(() => readLocal(OFFLINE_USED_KEY, []));
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineScansQueue));
      localStorage.setItem(OFFLINE_USED_KEY, JSON.stringify(offlineUsedCodes));
    } catch { /* stockage indisponible */ }
  }, [offlineScansQueue, offlineUsedCodes]);

  // Live Camera stream state
  const [useLiveCamera, setUseLiveCamera] = useState(false);
  const [liveCameraError, setLiveCameraError] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraDecoding, setCameraDecoding] = useState(false);

  useEffect(() => {
    if (!useLiveCamera || subTab !== 'scanner') {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let decodeTimer: number | undefined;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLiveCameraError("L'accès à la caméra requiert une connexion HTTPS ou un appareil avec capteur vidéo.");
      setUseLiveCamera(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
        setLiveCameraError(null);
        // Lecture automatique des QR codes (API BarcodeDetector : Chrome Android, Edge, Chrome desktop récent).
        const Detector = (window as any).BarcodeDetector;
        if (!Detector) { setCameraDecoding(false); return; }
        let detector: any;
        try { detector = new Detector({ formats: ['qr_code'] }); } catch { setCameraDecoding(false); return; }
        setCameraDecoding(true);
        let last = '';
        let lastAt = 0;
        const tick = async () => {
          if (!isMounted) return;
          const video = cameraVideoRef.current;
          if (video && video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const value: string | undefined = codes?.[0]?.rawValue;
              // Le même QR n'est pas revalidé pendant 4 secondes (le billet reste devant la caméra).
              if (value && (value !== last || Date.now() - lastAt > 4000)) {
                last = value;
                lastAt = Date.now();
                triggerScanRef.current(value);
              }
            } catch { /* image illisible : on réessaie */ }
          }
          decodeTimer = window.setTimeout(tick, 250);
        };
        tick();
      })
      .catch((err) => {
        console.warn('Live camera error:', err);
        setLiveCameraError('Accès caméra refusé. Utilisez la saisie manuelle ou les boutons de test.');
        setUseLiveCamera(false);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(decodeTimer);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [useLiveCamera, subTab]);

  // Batch Ranges Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchModalMode, setBatchModalMode] = useState<'create' | 'view'>('create');
  const [batchModalEventId, setBatchModalEventId] = useState<string>('');
  const [inspectingBatch, setInspectingBatch] = useState<TicketBatchRange | null>(null);
  const [isPrintBatchModalOpen, setIsPrintBatchModalOpen] = useState(false);
  const [printingBatch, setPrintingBatch] = useState<TicketBatchRange | null>(null);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchEventFilter, setBatchEventFilter] = useState('all');

  // Create Event Modal state
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtCategory, setEvtCategory] = useState<EventCategory>('Concert & Festival');
  const [evtOrganizer, setEvtOrganizer] = useState(currentUserSession.name || '');
  const [evtPhone, setEvtPhone] = useState(currentUserSession.phone || '+243 ');
  const [evtVenue, setEvtVenue] = useState('');
  const [evtCity, setEvtCity] = useState('Kinshasa');
  const [evtDate, setEvtDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    d.setHours(19, 0, 0, 0);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T19:00`;
  });
  const [evtOwnerId, setEvtOwnerId] = useState('');
  const [stdPrice, setStdPrice] = useState('');
  const [stdCap, setStdCap] = useState('');
  const [vipPrice, setVipPrice] = useState('');
  const [vipCap, setVipCap] = useState('0');
  const [vvipPrice, setVvipPrice] = useState('');
  const [vvipCap, setVvipCap] = useState('0');
  const [evtCommissionType, setEvtCommissionType] = useState<'default' | 'custom'>('default');
  const [evtCustomCommission, setEvtCustomCommission] = useState('10.0');

  // Purchase Modal with Mobile Money processing state
  const [buyingEvent, setBuyingEvent] = useState<TicketingEvent | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'processing_payment' | 'confirmed'>('form');
  const [selectedTier, setSelectedTier] = useState<'Standard' | 'VIP' | 'VVIP'>('VIP');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoPercent, setAppliedPromoPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerRail, setBuyerRail] = useState<FintechRail>('Espèces');
  const [guestNames, setGuestNames] = useState<string[]>(['']);
  const [generatedPurchasedPasses, setGeneratedPurchasedPasses] = useState<EventTicketPass[]>([]);
  const [paymentTransactionRef, setPaymentTransactionRef] = useState('');

  // Pass Detail Modal (Anti-screenshot QR & Share)
  const [inspectedPass, setInspectedPass] = useState<EventTicketPass | null>(null);

  // Scanner state
  const [selectedGate, setSelectedGate] = useState(configuredGates[0]);
  const [scanEventId, setScanEventId] = useState('');
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
  const [passStatusFilter, setPassStatusFilter] = useState<
    'all' | 'valid' | 'used' | 'blacklisted' | 'batch'
  >('all');

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
    let totalCommissionUSD = 0;

    // Montants réellement encaissés (remises comprises), billet par billet.
    for (const p of passes) {
      if (p.status === 'cancelled') continue;
      totalTicketsSold += 1;
      totalGrossUSD += p.pricePaidUSD || 0;
      totalCommissionUSD += p.platformFeeUSD || 0;
    }

    const checkedInPassesCount = passes.filter((p) => p.status === 'used').length;
    const blacklistedPassesCount = passes.filter((p) => p.status === 'blacklisted').length;
    const totalOrganizerPayoutsUSD = organizerPayouts.filter((p) => p.status === 'completed').reduce((acc, p) => acc + p.amountUSD, 0);

    const totalBatchPlacesSold = batches.reduce((acc, b) => acc + b.quantity, 0);
    const totalBatchPlacesScanned = batches.reduce((acc, b) => acc + (b.scannedCount || 0), 0);
    const totalBatchValueUSD = batches.reduce((acc, b) => acc + (b.totalValueUSD || 0), 0);

    return {
      totalTicketsSold,
      totalGrossUSD,
      totalCommissionUSD,
      checkedInPassesCount,
      blacklistedPassesCount,
      totalOrganizerPayoutsUSD,
      totalBatchPlacesSold,
      totalBatchPlacesScanned,
      totalBatchValueUSD,
    };
  }, [events, passes, organizerPayouts, batches]);

  // Handle Event Creation
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtVenue.trim()) return;
    if (organizers && !evtOwnerId) return;
    const owner = organizers?.find(o => o.id === evtOwnerId);

    const chosenCommission =
      evtCommissionType === 'default'
        ? 10.0
        : Math.max(0, Math.min(50, parseFloat(evtCustomCommission) || 10.0));

    try {
    await onCreateEvent({
      title: evtTitle.trim(),
      category: evtCategory,
      organizerName: owner?.name || evtOrganizer.trim() || currentUserSession.name,
      organizerPhone: owner?.phone || evtPhone.trim(),
      ownerId: owner?.id,
      venue: evtVenue.trim(),
      city: evtCity.trim(),
      eventDate: new Date(evtDate).toISOString(),
      // Aucune valeur inventée : une catégorie sans prix ni jauge est simplement fermée (capacité 0).
      standardPriceUSD: parseFloat(stdPrice.replace(',', '.')) || 0,
      standardCap: Math.max(0, parseInt(stdCap, 10) || 0),
      vipPriceUSD: parseFloat(vipPrice.replace(',', '.')) || 0,
      vipCap: Math.max(0, parseInt(vipCap, 10) || 0),
      vvipPriceUSD: parseFloat(vvipPrice.replace(',', '.')) || 0,
      vvipCap: Math.max(0, parseInt(vvipCap, 10) || 0),
      commissionRatePercent: chosenCommission,
    });
    } catch {
      return; // message d'erreur affiché par l'application
    }
    setEvtTitle('');
    setEvtVenue('');
    setEvtCommissionType('default');
    setEvtCustomCommission('10.0');
    setIsCreateEventOpen(false);
  };

  // Promo Code Validation
  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    const promo = promoCodes.find(p => p.active !== false && p.code.toUpperCase() === code);
    if (promo) {
      setAppliedPromoPercent(promo.percent);
      setPromoMessage(`Code ${promo.code} validé : -${promo.percent} %`);
    } else {
      setAppliedPromoPercent(0);
      setPromoMessage(code ? 'Code promotionnel invalide' : '');
    }
  };

  // Step 1: Initiate Payment
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyingEvent || !buyerName.trim()) return;
    setCheckoutStep('processing_payment');
    try {
      const generated = await onPurchaseTicketPasses({
        eventId: buyingEvent.id,
        tierName: selectedTier,
        holderName: buyerName.trim(),
        holderPhone: buyerPhone.trim(),
        paymentRail: buyerRail,
        quantity: ticketQuantity,
        promoCode: appliedPromoPercent > 0 ? promoCodeInput.trim().toUpperCase() : undefined,
        guestNames: guestNames.map((g, idx) =>
          g.trim() ? g.trim() : `${buyerName.trim()} (Billet #${idx + 1})`
        ),
      });
      setPaymentTransactionRef(generated[0]?.transactionReference || '');
      setGeneratedPurchasedPasses(generated);
      setCheckoutStep('confirmed');
    } catch {
      setCheckoutStep('form'); // le serveur a refusé : message affiché, l'acheteur n'est pas débité
    }
  };

  // Scan Verification Engine
  const scanBusyRef = useRef(false);
  const triggerScanVerification = async (codeToScan: string) => {
    const raw = codeToScan.trim();
    const cleanCode = extractPassCode(raw);
    if (!cleanCode || scanBusyRef.current) return;

    const showResult = (res: ScanOutcome, offline: boolean) => {
      if (res.outcome === 'valid_entry') { if (soundEnabled) playSuccessChime(); }
      else if (res.outcome === 'blacklisted') { if (soundEnabled) playBlacklistAlarm(); }
      else if (soundEnabled) playAlertBuzzer();
      setScanResult({ ...res, scannedCode: cleanCode, gate: selectedGate, scannedBy: currentUserSession.name, offlineModeActive: offline });
    };

    // MODE HORS-LIGNE : contrôle sur la dernière liste reçue + billets déjà entrés sur CE poste.
    if (isOfflineMode) {
      const localPass = passes.find((p) => p.passCode.toUpperCase() === cleanCode);
      let outcome: ScanOutcome['outcome'];
      if (!localPass) outcome = 'not_found';
      else if (localPass.status === 'blacklisted' || localPass.status === 'cancelled') outcome = 'blacklisted';
      else if (localPass.status === 'used' || offlineUsedCodes.includes(cleanCode)) outcome = 'fraud_duplicate';
      else outcome = 'valid_entry';

      if (outcome === 'valid_entry') setOfflineUsedCodes((prev) => [...prev, cleanCode]);
      const offlineItem: OfflineScanItem = {
        id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        passCode: cleanCode,
        gate: selectedGate,
        scannedBy: currentUserSession.name,
        scannedAtOffline: new Date().toLocaleTimeString('fr-FR'),
        outcome,
      };
      setOfflineScansQueue((prev) => [offlineItem, ...prev]);
      showResult({ outcome, pass: localPass }, true);
      return;
    }

    // EN LIGNE : le serveur valide (une seule entrée possible, même avec plusieurs portiques).
    scanBusyRef.current = true;
    try {
      const res = await onScanTicketPass(raw, selectedGate, scanEventId || undefined);
      showResult(res, false);
    } catch {
      setScanResult(null);
    } finally {
      scanBusyRef.current = false;
    }
  };

  const triggerScanRef = useRef(triggerScanVerification);
  triggerScanRef.current = triggerScanVerification;

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerScanVerification(scanInput);
    setScanInput('');
  };

  // Sync Offline Scans to Main Server
  const handleSyncOfflineQueue = async () => {
    if (offlineScansQueue.length === 0) return;
    try {
      await onSyncOfflineScans?.(offlineScansQueue);
      setOfflineScansQueue([]);
      setOfflineUsedCodes([]);
      setIsOfflineMode(false);
    } catch {
      /* réseau encore indisponible : la file est conservée */
    }
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
      const matchesStatus =
        passStatusFilter === 'all'
          ? true
          : passStatusFilter === 'batch'
          ? Boolean(p.isBatchTicket)
          : p.status === passStatusFilter;

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
              <span className="text-sky-800">QR signé par le serveur</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Portique Anti-Fraude & Billetterie Mobile Money (Orange, Airtel, M-Pesa)
            </h1>
            <p className="text-xs text-slate-500 max-w-3xl">
              Billets à QR code signé (HMAC-SHA256), validés par le serveur au portique : une seule entrée par billet, même avec plusieurs portes. Mode hors-ligne avec synchronisation.
            </p>
          </div>

          {/* Quick Action Buttons & Role Badge */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* User Session Badge with click to open Auth Modal */}
            <button
              type="button"
              onClick={() => onOpenAccount?.()}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-950 hover:bg-sky-100 transition-colors shadow-2xs"
              title="Mon compte (mot de passe, déconnexion)"
            >
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
            {canManage && (<>
            <button
              type="button"
              onClick={() => setIsCreateEventOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Créer Événement</span>
            </button>

            {/* Generate Batch Button (Plage de Billets) */}
            <button
              type="button"
              onClick={() => {
                setBatchModalMode('create');
                setBatchModalEventId(events[0]?.id || '');
                setIsBatchModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-purple-600 bg-purple-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-xs"
              title="Émettre une plage / série de billets physiques ou guichet comptabilisés comme vendus"
            >
              <Layers className="h-4 w-4" />
              <span>+ Plage de Billets</span>
            </button>
            </>)}

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

        {canManage && (<>
{/* SIGNALEMENT SYSTÈME ADMIN : PLAGES DE BILLETS ÉMISES & PLACES COMPTABILISÉES VENDUES */}
        <div className="mt-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 via-white to-sky-50 p-4 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-purple-400 bg-purple-600 text-white shadow-xs shrink-0 mt-0.5">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md border border-purple-400 bg-purple-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-900 font-mono">
                    📡 Signalement Système Admin
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {batches.length} Plage(s) de Billets Émise(s) & Actives
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-snug">
                  Les billets générés par plage/lot sont <strong>enregistrés et comptabilisés comme places vendues</strong>{' '}
                  au Dashboard de l&apos;événement, et chaque billet individuel est <strong>vérifiable au scanner avant l&apos;entrée</strong>.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs font-mono">
                  <span className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-purple-900 font-bold">
                    🎟️ <strong>{metrics.totalBatchPlacesSold}</strong> places vendues en plages
                  </span>
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 font-bold">
                    ✓ <strong>{metrics.totalBatchPlacesScanned}</strong> scannées au portique (
                    {metrics.totalBatchPlacesSold > 0
                      ? Math.round((metrics.totalBatchPlacesScanned / metrics.totalBatchPlacesSold) * 100)
                      : 0}
                    %)
                  </span>
                  <span className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-sky-900 font-bold">
                    💰 Valeur : <strong>{formatMoney(metrics.totalBatchValueUSD, displayCurrency, settings.rates)}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBatchModalMode('create');
                  setBatchModalEventId(events[0]?.id || '');
                  setIsBatchModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-purple-600 bg-purple-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Générer Plage</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('batches')}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:border-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <Eye className="h-4 w-4 text-slate-500" />
                <span>Gérer Lots ({batches.length})</span>
              </button>
            </div>
          </div>
        </div>
</>)}

      </div>

      {canManage && (<>
{/* 4 Crisp Metric Cards with Sky-Blue, Purple & Crimson Highlights */}
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
            {metrics.totalBatchPlacesSold > 0 && (
              <span className="text-purple-700 font-bold block sm:inline sm:ml-1">
                (dont {metrics.totalBatchPlacesSold} en plages guichet)
              </span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-rose-300 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
            Commission KolaPass
          </span>
          <div className="mt-1 text-2xl font-black text-rose-700 font-mono tabular-nums">
            +{formatMoney(metrics.totalCommissionUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Prélèvement automatique à chaque vente Mobile Money & lot guichet
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
            {metrics.totalBatchPlacesScanned > 0 && (
              <span className="text-purple-700 font-bold block sm:inline sm:ml-1">
                · {metrics.totalBatchPlacesScanned} issu(s) de plages
              </span>
            )}
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
            Doublons et billets bloqués refusés au portique
          </p>
        </div>
      </div>
</>)}

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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                            {ev.category}
                          </span>
                          {ev.status === 'completed' || new Date(ev.eventDate).getTime() < Date.now() ? (
                            <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 font-mono">
                              ⏳ Antérieur (Clôturé)
                            </span>
                          ) : (
                            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 font-mono">
                              🟢 Disponible
                            </span>
                          )}
                        </div>
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
                      {ev.status === 'completed' || new Date(ev.eventDate).getTime() < Date.now() ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-slate-200 py-2.5 px-3 text-xs font-bold text-slate-500 cursor-not-allowed shadow-2xs"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Clôturé</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBuyingEvent(ev);
                            setCheckoutStep('form');
                            setSelectedTier('Standard');
                            setTicketQuantity(1);
                            setBuyerName('');
                            setBuyerPhone('');
                            setGuestNames(['']);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-700 py-2.5 px-3 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-2xs"
                        >
                          <Ticket className="h-3.5 w-3.5" />
                          <span>Vendre des billets</span>
                        </button>
                      )}

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
                        <span>Virement {(100 - (ev.commissionRatePercent || 10.0)).toFixed(0)}%</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBatchModalMode('create');
                        setBatchModalEventId(ev.id);
                        setIsBatchModalOpen(true);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-purple-300 bg-purple-50 py-2 px-3 text-xs font-bold text-purple-950 hover:bg-purple-100 hover:border-purple-400 transition-colors shadow-2xs"
                    >
                      <Layers className="h-3.5 w-3.5 text-purple-700" />
                      <span>🏷️ Générer une Plage de Billets (Guichet / Lot)</span>
                    </button>

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

      {/* SUBTAB 2: PLAGES DE BILLETS (LOTS GUICHET & PARTENAIRES) */}
      {subTab === 'batches' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-purple-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-700" />
                <h2 className="text-base font-extrabold text-slate-900">
                  Gestion & Traçabilité des Plages de Billets (Lots Guichet & Partenaires)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chaque plage générée est enregistrée au Dashboard comme places vendues et chaque billet individuel est vérifiable au scanner avant l&apos;entrée.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatchModalMode('create');
                  setBatchModalEventId(events[0]?.id || '');
                  setIsBatchModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-purple-600 bg-purple-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>+ Nouvelle Plage de Billets</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Stats Cards for Batches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border-2 border-purple-300 bg-white p-4 shadow-2xs">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-purple-800">
                Plages Émises & Actives
              </span>
              <div className="mt-1 text-2xl font-black text-slate-900 font-mono">
                {batches.length}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Lots de distribution physique
              </p>
            </div>

            <div className="rounded-2xl border-2 border-purple-300 bg-white p-4 shadow-2xs">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-purple-800">
                Places Comptabilisées Vendues
              </span>
              <div className="mt-1 text-2xl font-black text-purple-900 font-mono">
                {metrics.totalBatchPlacesSold.toLocaleString('fr-FR')}
              </div>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Intégrées aux recettes de l&apos;événement
              </p>
            </div>

            <div className="rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-2xs">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-800">
                Billets Scannés au Portique
              </span>
              <div className="mt-1 text-2xl font-black text-emerald-700 font-mono">
                {metrics.totalBatchPlacesScanned} / {metrics.totalBatchPlacesSold}
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Taux de présence :{' '}
                {metrics.totalBatchPlacesSold > 0
                  ? Math.round((metrics.totalBatchPlacesScanned / metrics.totalBatchPlacesSold) * 100)
                  : 0}
                %
              </p>
            </div>

            <div className="rounded-2xl border-2 border-sky-300 bg-white p-4 shadow-2xs">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Valeur Totale Comptabilisée
              </span>
              <div className="mt-1 text-2xl font-black text-slate-900 font-mono">
                {formatMoney(metrics.totalBatchValueUSD, displayCurrency, settings.rates)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Équivalent double-devise
              </p>
            </div>
          </div>

          {/* Search & Event Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                placeholder="Rechercher par nom de lot, code, distributeur..."
                className="w-full rounded-xl border-2 border-purple-200 bg-white pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={batchEventFilter}
                onChange={(e) => setBatchEventFilter(e.target.value)}
                className="w-full rounded-xl border-2 border-purple-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-purple-600 focus:outline-none"
              >
                <option value="all">Tous les événements</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Batches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {batches
              .filter((b) => {
                if (batchEventFilter !== 'all' && b.eventId !== batchEventFilter) return false;
                if (batchSearch.trim()) {
                  const q = batchSearch.toLowerCase();
                  return (
                    b.name.toLowerCase().includes(q) ||
                    b.batchNumber.toLowerCase().includes(q) ||
                    b.eventTitle.toLowerCase().includes(q) ||
                    (b.distributorName && b.distributorName.toLowerCase().includes(q))
                  );
                }
                return true;
              })
              .map((b) => {
                const scanPercent =
                  b.quantity > 0 ? Math.round((b.scannedCount / b.quantity) * 100) : 0;
                const matchingPasses = passes.filter((p) => p.batchId === b.id);
                const nextPassToScan = matchingPasses.find((p) => p.status === 'valid') || matchingPasses[0];

                return (
                  <div
                    key={b.id}
                    className="rounded-2xl border-2 border-purple-300 bg-white overflow-hidden shadow-xs hover:border-purple-400 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="p-5 space-y-4">
                      {/* Header Badge & Number */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="rounded-md border border-purple-400 bg-purple-100 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-900 uppercase">
                              {b.batchNumber}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                b.tierName === 'VVIP'
                                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                                  : b.tierName === 'VIP'
                                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                                  : 'border-sky-300 bg-sky-50 text-sky-800'
                              }`}
                            >
                              Catégorie {b.tierName}
                            </span>
                            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 font-mono">
                              ✓ Vendu
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 leading-snug mt-1">
                            {b.name}
                          </h3>
                        </div>

                        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-purple-200 bg-purple-50 px-2.5 py-1 font-mono text-center shrink-0">
                          <span className="text-base font-black text-purple-900 leading-none">
                            {b.quantity}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight mt-0.5">
                            Places
                          </span>
                        </div>
                      </div>

                      {/* Event Details */}
                      <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                          <span className="truncate font-semibold text-slate-800">
                            {b.eventTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-slate-600">
                          <Barcode className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span>
                            Plage : <strong>N° {b.startNumber}</strong> à <strong>N° {b.endNumber}</strong> (Préfixe : {b.prefix})
                          </span>
                        </div>
                        {b.distributorName && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              Distributeur : {b.distributorName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Real-time Scan Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-500 font-bold">
                          <span>Vérifiés au portique</span>
                          <span className="text-emerald-800 font-black">
                            {b.scannedCount} / {b.quantity} ({scanPercent}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full transition-all bg-emerald-600"
                            style={{ width: `${scanPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial info */}
                      <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-2.5 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="text-[10px] font-sans text-slate-500 uppercase">Tarif unitaire :</span>{' '}
                          <strong className="text-slate-900">{b.unitPriceUSD} $</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-sans text-slate-500 uppercase">Valeur totale :</span>{' '}
                          <strong className="text-purple-900 text-sm">
                            {formatMoney(b.totalValueUSD, displayCurrency, settings.rates)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="border-t-2 border-purple-100 bg-slate-50/70 p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingBatch(b);
                            setBatchModalMode('view');
                            setIsBatchModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white py-2 px-3 text-xs font-bold text-slate-800 hover:border-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                          <span>Voir Billets ({matchingPasses.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPrintingBatch(b);
                            setIsPrintBatchModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-sky-400 bg-sky-600 py-2 px-3 text-xs font-bold text-white hover:bg-sky-700 transition-colors shadow-2xs"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Imprimer Planche</span>
                        </button>
                      </div>

                      {nextPassToScan && (
                        <button
                          type="button"
                          onClick={() => {
                            setScanInput(nextPassToScan.passCode);
                            setSubTab('scanner');
                            triggerScanVerification(nextPassToScan.passCode);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-purple-600 bg-purple-700 py-2 px-3 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-2xs"
                        >
                          <ScanLine className="h-3.5 w-3.5" />
                          <span>⚡ Tester Scan Billet #{nextPassToScan.rangeIndex} ({nextPassToScan.passCode})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: SCANNER & CHECK-IN (CAMERA / OFFLINE STADIUM APP) */}
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

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setLiveCameraError(null);
                      setUseLiveCamera((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition-colors ${
                      useLiveCamera
                        ? 'border-rose-500 bg-rose-50 text-rose-900 shadow-xs'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {useLiveCamera ? (
                      <CameraOff className="h-3.5 w-3.5 text-rose-600" />
                    ) : (
                      <Video className="h-3.5 w-3.5 text-slate-600" />
                    )}
                    <span>{useLiveCamera ? 'Arrêter Caméra' : 'Activer Caméra Réelle'}</span>
                  </button>

                  <span className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${
                    isOfflineMode ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                    <span>{isOfflineMode ? 'Mode Stade Hors-Ligne' : 'Connecté Serveur'}</span>
                  </span>
                </div>
              </div>

              {/* Live camera error banner if any */}
              {liveCameraError && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{liveCameraError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLiveCameraError(null)}
                    className="text-amber-700 hover:text-amber-950 font-bold"
                  >
                    Fermer
                  </button>
                </div>
              )}

              {/* Porte et événement contrôlés (l'agent est le compte connecté) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="scan-gate" className="block font-bold text-slate-700 mb-1">Porte d&apos;accès :</label>
                  <select
                    id="scan-gate"
                    value={selectedGate}
                    onChange={(e) => setSelectedGate(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    {configuredGates.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="scan-event" className="block font-bold text-slate-700 mb-1">Événement contrôlé :</label>
                  <select
                    id="scan-event"
                    value={scanEventId}
                    onChange={(e) => setScanEventId(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    <option value="">Tous les événements</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>
                <p className="sm:col-span-2 text-[11px] text-slate-500">Agent : <strong>{currentUserSession.name}</strong> (enregistré automatiquement par le serveur)</p>
              </div>

              {/* Interactive Camera Viewfinder Box */}
              <div className="relative aspect-video w-full rounded-2xl border-4 border-slate-900 bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-6 text-white shadow-inner">
                {/* Real Camera Live Feed video tag */}
                {useLiveCamera && (
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full object-cover z-0"
                  />
                )}
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
                    {useLiveCamera ? (cameraDecoding ? '[LECTURE AUTOMATIQUE DU QR ACTIVE]' : '[CAMÉRA ACTIVE — LECTURE AUTO INDISPONIBLE]') : '[CAMÉRA ARRÊTÉE]'}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {useLiveCamera && !cameraDecoding
                      ? 'Ce navigateur ne lit pas les QR : utilisez Chrome sur Android, ou une douchette USB/Bluetooth dans le champ ci-dessous.'
                      : 'Présentez le QR du billet (téléphone ou papier) devant le viseur'}
                  </p>
                </div>
              </div>

              {/* Manual code input & Test Scan buttons */}
              <form onSubmit={handleManualScanSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Code du billet ou lecture douchette (ex. E01-7KQ9MZ3XPA)"
                  aria-label="Code du billet"
                  className="flex-1 rounded-xl border-2 border-sky-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 shadow-xs"
                >
                  Valider
                </button>
              </form>

              {/* Boutons de test (administrateur uniquement) */}
              {role === 'admin' && (
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-500">Test rapide :</span>
                {passes.slice(0, 3).map((p) => (
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
                {/* Specific batch ticket test buttons */}
                {passes
                  .filter((p) => p.isBatchTicket)
                  .slice(0, 3)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setScanInput(p.passCode);
                        triggerScanVerification(p.passCode);
                      }}
                      className={`rounded-lg border-2 px-2.5 py-1 text-[11px] font-mono font-bold transition-colors ${
                        p.status === 'used'
                          ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                          : 'border-purple-500 bg-purple-100 text-purple-950 hover:bg-purple-200 shadow-2xs'
                      }`}
                    >
                      🏷️ {p.passCode} (#{p.rangeIndex} - {p.status === 'used' ? 'Émargé' : 'Prêt'})
                    </button>
                  ))}
              </div>
              )}
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
                      {/* Batch recognition highlight if batch ticket */}
                      {scanResult.pass.isBatchTicket && (
                        <div className="rounded-xl border-2 border-purple-300 bg-purple-100/80 p-3 space-y-1 text-purple-950 font-sans shadow-2xs">
                          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-900">
                            <Layers className="h-4 w-4 text-purple-700 shrink-0" />
                            <span>🏷️ Billet Issu d&apos;une Plage Organisateur (Lot Guichet)</span>
                          </div>
                          <div className="text-xs font-semibold">
                            Lot : <strong className="font-bold">{scanResult.pass.batchName || scanResult.pass.batchNumber}</strong>
                          </div>
                          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-purple-800">
                            <span>Série : <strong>N° {scanResult.pass.rangeIndex} sur {scanResult.pass.rangeTotal}</strong></span>
                            {scanResult.pass.distributorName && (
                              <span>Point : <strong>{scanResult.pass.distributorName}</strong></span>
                            )}
                          </div>
                          <div className="pt-0.5 text-[10px] text-purple-700 font-medium">
                            ✓ Comptabilisé Vendu dès son émission & Contrôlé conforme au Portique
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <img
                          src={
                            scanResult.pass.avatarUrl || initialsAvatar(scanResult.pass.holderName)
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
                <option value="batch">🏷️ Billets de Plages (Lots Guichet)</option>
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
                        {p.isBatchTicket && (
                          <span className="inline-block mt-0.5 rounded-md border border-purple-300 bg-purple-50 px-1.5 py-0.2 text-[9px] font-bold text-purple-900 font-sans">
                            Lot: #{p.rangeIndex} ({p.batchNumber})
                          </span>
                        )}
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
                          {p.qrSignature}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              p.avatarUrl || initialsAvatar(p.holderName)
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
            {onClearAccessLogs && (
            <button
              type="button"
              onClick={onClearAccessLogs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Vider le journal</span>
            </button>
            )}
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

      {/* SUBTAB 5: ORGANIZER PAYOUTS (REVERSEMENTS PROMOTEURS) */}
      {subTab === 'organizers' && (
        <div className="rounded-2xl border-2 border-sky-300 bg-white p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Reversements Financiers Promoteurs & Organisateurs
              </h2>
              <p className="text-xs text-slate-500">
                L&apos;organisateur demande un reversement (dans la limite de son solde net, commission déduite) ; l&apos;administrateur effectue le transfert puis le marque « payé » avec sa référence.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-sky-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 border-sky-200 bg-sky-50 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">ID Reversement</th>
                  <th className="p-3">Événement & Organisateur</th>
                  <th className="p-3">Montant</th>
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
                      {p.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Payé{p.transferReference ? ` (${p.transferReference})` : ''}
                        </span>
                      ) : p.status === 'rejected' ? (
                        <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800" title={p.rejectReason}>Refusé</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">En attente de l&apos;administrateur</span>
                      )}
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
              Modèle Économique & Rentabilité KolaPass (Commission par Défaut : 10%)
            </h2>
            <p className="text-xs text-slate-500">
              Chaque billet émis génère par défaut 10,0% de marge brute (configurable librement lors de la création de chaque événement) directement prélevée lors de la transaction Mobile Money.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/60 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Commission Plateforme
              </span>
              <div className="mt-1 text-2xl font-black text-slate-900">10,0 %</div>
              <p className="mt-1 text-xs text-slate-500">
                Taux par défaut appliqué aux nouveaux événements (ajustable à la création).
              </p>
            </div>

            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/60 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Reversement Promoteur
              </span>
              <div className="mt-1 text-2xl font-black text-rose-900">90,0 %</div>
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

      {/* MODAL 2: TICKET PASS DETAIL MODAL (ANTI-SCREENSHOT DYNAMIC QR, WHATSAPP, EMAIL, SMS & BLACKLIST) */}
      <TicketPassDetailModal
        pass={inspectedPass}
        displayCurrency={displayCurrency}
        settings={settings}
        currentUserRole={currentUserSession.role}
        onClose={() => setInspectedPass(null)}
        onBlacklistPass={!canManage ? undefined : (id, reason) => {
          onBlacklistPass?.(id, reason);
          setInspectedPass((prev) =>
            prev && prev.id === id ? { ...prev, status: 'blacklisted', blacklistReason: reason } : prev
          );
        }}
        onReactivatePass={!canManage ? undefined : (id) => {
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
                  placeholder="Ex : Concert de fin d'année"
                  className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                />
              </div>

              {organizers && (
                <div>
                  <label htmlFor="evt-owner" className="block font-bold text-slate-700 mb-1">Organisateur responsable</label>
                  <select
                    id="evt-owner"
                    required
                    value={evtOwnerId}
                    onChange={(e) => setEvtOwnerId(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:border-rose-600 focus:outline-none"
                  >
                    <option value="">— Choisir —</option>
                    <option value={currentUserSession.id}>{currentUserSession.name} (moi, administrateur)</option>
                    {organizers.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  {organizers.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">Aucun compte organisateur : créez-en un dans « Administration », ou rattachez l&apos;événement à vous-même.</p>
                  )}
                </div>
              )}

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

              {/* Configuration du Taux de Commission KolaPass (Par défaut 10%) */}
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-rose-700" />
                    <span>Commission Plateforme KolaPass</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md">
                    Par défaut : 10,0%
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEvtCommissionType('default');
                        setEvtCustomCommission('10.0');
                      }}
                      className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                        evtCommissionType === 'default'
                          ? 'border-rose-600 bg-rose-100/70 text-rose-950 font-bold ring-1 ring-rose-500 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-extrabold text-xs">Standard Défaut (10%)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Taux officiel par défaut de la plateforme
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEvtCommissionType('custom')}
                      className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                        evtCommissionType === 'custom'
                          ? 'border-rose-600 bg-rose-100/70 text-rose-950 font-bold ring-1 ring-rose-500 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-extrabold text-xs">Taux Négocié (%)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Commission personnalisée pour ce concert
                      </div>
                    </button>
                  </div>

                  {evtCommissionType === 'custom' && (
                    <div className="rounded-xl border border-rose-200 bg-white p-3 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold text-slate-800">
                          Pourcentage prélevé par KolaPass :
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={evtCustomCommission}
                            onChange={(e) => setEvtCustomCommission(e.target.value)}
                            className="w-20 rounded-lg border-2 border-rose-300 bg-white p-1 text-center font-mono font-bold text-slate-900 focus:outline-none"
                          />
                          <span className="ml-1.5 font-bold text-slate-700">%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                        <span className="text-slate-500 font-medium">Préréglages :</span>
                        {['5.0', '8.0', '10.0', '12.0', '15.0'].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setEvtCustomCommission(rate)}
                            className={`rounded px-1.5 py-0.5 border font-mono font-bold transition-colors ${
                              evtCustomCommission === rate
                                ? 'bg-rose-700 text-white border-rose-700'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time split preview */}
                  <div className="flex items-center justify-between rounded-lg bg-white/80 p-2 text-[11px] font-mono border border-rose-200/80">
                    <span className="text-rose-900 font-bold">
                      Part KolaPass : {evtCommissionType === 'default' ? '10.0' : evtCustomCommission}%
                    </span>
                    <span className="text-emerald-800 font-bold">
                      Part Promoteur : {(100 - (evtCommissionType === 'default' ? 10.0 : (parseFloat(evtCustomCommission) || 10.0))).toFixed(1)}%
                    </span>
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
                    Téléphone de l'acheteur
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
                    4. Moyen de paiement encaissé
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
                  <span>Paiement reçu ({buyerRail}) : émettre les billets</span>
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
                    Émission des billets par le serveur…
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                    Vente enregistrée pour{' '}
                    <strong className="font-mono text-slate-800">{buyerPhone}</strong> ({' '}
                    <strong className="text-rose-800">{buyerRail}</strong>).
                  </p>
                </div>
                <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-[11px] text-sky-900 font-mono">
                  * Émettez les billets seulement après avoir reçu le paiement.
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
                    Billets émis !
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
                  Demander le reversement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET BATCH MODAL (CREATE / VIEW) */}
      <TicketBatchModal
        isOpen={isBatchModalOpen}
        onClose={() => {
          setIsBatchModalOpen(false);
          setInspectingBatch(null);
        }}
        mode={batchModalMode}
        events={events}
        selectedEventId={batchModalEventId}
        inspectingBatch={inspectingBatch}
        batchPasses={inspectingBatch ? passes.filter((p) => p.batchId === inspectingBatch.id) : []}
        displayCurrency={displayCurrency}
        settings={settings}
        currentUserSession={currentUserSession}
        onGenerateBatch={(payload) => {
          if (onGenerateBatch) {
            return onGenerateBatch(payload);
          }
          throw new Error('Action de génération non disponible.');
        }}
        onPrintBatch={(b) => {
          setPrintingBatch(b);
          setIsPrintBatchModalOpen(true);
        }}
        onTestScanPass={(passCode) => {
          setScanInput(passCode);
          setSubTab('scanner');
          triggerScanVerification(passCode);
        }}
      />

      {/* TICKET BATCH PRINT MODAL */}
      <TicketBatchPrintModal
        isOpen={isPrintBatchModalOpen}
        onClose={() => {
          setIsPrintBatchModalOpen(false);
          setPrintingBatch(null);
        }}
        batch={printingBatch}
        passes={printingBatch ? passes.filter((p) => p.batchId === printingBatch.id) : []}
        displayCurrency={displayCurrency}
        settings={settings}
      />
    </div>
  );
};
