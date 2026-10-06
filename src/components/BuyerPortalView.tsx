import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Flame,
  Heart,
  HelpCircle,
  Info,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  EventTicketPass,
  FintechRail,
  StoreSettings,
  TicketingEvent,
} from '../types';
import { formatDateTime, formatMoney, initialsAvatar } from '../utils/format';
import { SvgQrCode } from './SvgQrCode';
import { getDynamicQrToken } from '../utils/cryptoJwt';

interface BuyerPortalViewProps {
  events: TicketingEvent[];
  passes: EventTicketPass[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  onPurchasePasses: (payload: {
    eventId: string;
    tierName: 'Standard' | 'VIP' | 'VVIP';
    holderName: string;
    holderPhone: string;
    paymentRail: FintechRail;
    quantity?: number;
    discountPercent?: number;
    guestNames?: string[];
  }) => EventTicketPass[] | Promise<EventTicketPass[]>;
  onExitToConsole: () => void;
}

export const BuyerPortalView: React.FC<BuyerPortalViewProps> = ({
  events,
  passes,
  displayCurrency,
  settings,
  onPurchasePasses,
  onExitToConsole,
}) => {
  // Helper to determine if an event is "antérieur" (completed status or past date)
  const isEventPast = (ev: TicketingEvent): boolean => {
    return ev.status === 'completed' || new Date(ev.eventDate).getTime() < Date.now();
  };

  // Rule: Client / Acheteur has access ONLY to events that are "disponibles" or "antérieurs"
  // (strictly filter out draft, unapproved or hidden events)
  const allowedEvents = useMemo(() => {
    return events.filter(
      (ev) => ev.status === 'upcoming' || ev.status === 'completed'
    );
  }, [events]);

  // Event category filter: 'available' (billetterie ouverte) | 'past' (antérieurs clôturés) | 'all'
  const [eventFilter, setEventFilter] = useState<'available' | 'past' | 'all'>('available');

  const availableEvents = useMemo(() => {
    return allowedEvents.filter((ev) => !isEventPast(ev));
  }, [allowedEvents]);

  const pastEvents = useMemo(() => {
    return allowedEvents.filter((ev) => isEventPast(ev));
  }, [allowedEvents]);

  const displayedEvents = useMemo(() => {
    if (eventFilter === 'available') return availableEvents;
    if (eventFilter === 'past') return pastEvents;
    return allowedEvents;
  }, [eventFilter, availableEvents, pastEvents, allowedEvents]);

  // Currently viewed event
  const [selectedEventId, setSelectedEventId] = useState<string>(
    availableEvents[0]?.id || allowedEvents[0]?.id || ''
  );

  const currentEvent = useMemo(() => {
    const found = displayedEvents.find((e) => e.id === selectedEventId);
    if (found) return found;
    return displayedEvents[0] || allowedEvents[0];
  }, [displayedEvents, selectedEventId, allowedEvents]);

  const isCurrentEventPast = currentEvent ? isEventPast(currentEvent) : false;

  // Navigation tab for buyer
  const [buyerTab, setBuyerTab] = useState<'checkout' | 'my_tickets'>('checkout');

  // Tickets Wallet filter: 'all' | 'active' | 'past'
  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'past'>('all');

  const filteredBuyerPasses = useMemo(() => {
    return passes.filter((p) => {
      const isPast = new Date(p.eventDate).getTime() < Date.now() || p.status === 'used';
      if (ticketFilter === 'active') return !isPast;
      if (ticketFilter === 'past') return isPast;
      return true;
    });
  }, [passes, ticketFilter]);

  // Checkout step
  const [selectedTier, setSelectedTier] = useState<'Standard' | 'VIP' | 'VVIP'>(
    'VIP'
  );
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('Grâce Lukunku');
  const [buyerPhone, setBuyerPhone] = useState('+243 81 999 8877');
  const [buyerEmail, setBuyerEmail] = useState('grace.lukunku@gmail.com');
  const [guestNames, setGuestNames] = useState<string[]>(['Grâce Lukunku']);
  const [selectedRail, setSelectedRail] = useState<FintechRail>('M-Pesa');
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');

  // Payment USSD Push state
  const [checkoutStep, setCheckoutStep] = useState<
    'form' | 'ussd_pending' | 'success'
  >('form');
  const [newlyIssuedPasses, setNewlyIssuedPasses] = useState<EventTicketPass[]>(
    []
  );
  const [latestPass, setLatestPass] = useState<EventTicketPass | null>(null);

  // Dynamic QR Code anti-screenshot timer (30s rolling epoch)
  const [dynamicQrToken, setDynamicQrToken] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  // Update dynamic QR token for active ticket
  useEffect(() => {
    if (!latestPass) return;
    const update = () => {
      const { dynamicCode, secondsRemaining: sec } = getDynamicQrToken(
        latestPass.passCode,
        30
      );
      setDynamicQrToken(dynamicCode);
      setSecondsRemaining(sec);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [latestPass]);

  // If newly issued passes exist, auto-select first one as latest
  useEffect(() => {
    if (newlyIssuedPasses.length > 0) {
      setLatestPass(newlyIssuedPasses[0]);
    } else if (passes.length > 0 && !latestPass) {
      setLatestPass(passes[0]);
    }
  }, [newlyIssuedPasses, passes, latestPass]);

  if (!currentEvent) {
    return (
      <div className="p-8 text-center text-slate-500">
        Aucun événement disponible actuellement.
      </div>
    );
  }

  // Price calculations
  const activeTierObj =
    currentEvent.tiers.find((t) => t.name === selectedTier) ||
    currentEvent.tiers[0];
  const unitPriceUSD = activeTierObj?.priceUSD || 25;
  const subtotalUSD = unitPriceUSD * quantity;
  const discountUSD = subtotalUSD * (discountPercent / 100);
  const totalUSD = subtotalUSD - discountUSD;

  const handleApplyPromo = () => {
    const c = promoCode.trim().toUpperCase();
    if (c === 'EARLYBIRD' || c === 'EARLY10') {
      setDiscountPercent(10);
      setPromoMessage('Réduction Early Bird appliquée : -10%');
    } else if (c === 'VIP2026' || c === 'KOLA15') {
      setDiscountPercent(15);
      setPromoMessage('Code VIP appliqué : -15%');
    } else {
      setDiscountPercent(0);
      setPromoMessage('Code non reconnu');
    }
  };

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerPhone.trim()) return;

    setCheckoutStep('ussd_pending');

    void (async () => {
      let created: EventTicketPass[];
      try {
        created = await onPurchasePasses({
        eventId: currentEvent.id,
        tierName: selectedTier,
        holderName: buyerName.trim(),
        holderPhone: buyerPhone.trim(),
        paymentRail: selectedRail,
        quantity,
        discountPercent,
        guestNames: guestNames.map((g, i) =>
          g.trim() ? g.trim() : `${buyerName} (Billet #${i + 1})`
        ),
      });
      } catch {
        setCheckoutStep('form');
        return;
      }

      setNewlyIssuedPasses(created);
      if (created.length > 0) {
        setLatestPass(created[0]);
      }
      setCheckoutStep('success');
    })();
  };

  const handleSendToWhatsApp = (pass: EventTicketPass) => {
    const text = encodeURIComponent(
      `🎟️ *Mon Pass Officiel KolaPass*\n\n` +
      `*Événement* : ${pass.eventTitle}\n` +
      `*Billet* : ${pass.tierName} (${pass.passCode})\n` +
      `*Titulaire* : ${pass.holderName}\n` +
      `*Lieu* : ${pass.venue}\n` +
      `*Date* : ${formatDateTime(pass.eventDate)}\n\n` +
      `Présentez ce QR Code dynamique à l'entrée. Signature HMAC-SHA256 intégrée.`
    );
    window.open(`https://wa.me/${pass.holderPhone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Buyer Simulation Notice Bar & Access Rights Rule */}
      <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/70 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-900 text-white font-mono text-xs font-bold shrink-0">
              👁️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-950 uppercase tracking-wide">
                  Espace Acheteur Public (Client Tiers)
                </span>
                <span className="rounded-md border border-emerald-400 bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-800 font-mono">
                  ACCÈS STRICT
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Règle légale : Le client n&apos;a le droit de consulter que les <strong>événements disponibles</strong> (ouverts à l&apos;achat) et <strong>antérieurs</strong> (archives et historique de ses pass).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Switch Tab between Buying and My Wallet */}
            <div className="flex items-center rounded-xl border border-slate-300 bg-white p-1 text-xs">
              <button
                type="button"
                onClick={() => setBuyerTab('checkout')}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  buyerTab === 'checkout'
                    ? 'border border-slate-800 bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Guichet Billetterie
              </button>
              <button
                type="button"
                onClick={() => setBuyerTab('my_tickets')}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  buyerTab === 'my_tickets'
                    ? 'border border-slate-800 bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes Billets ({passes.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onExitToConsole}
              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
            >
              ← Console Admin
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & EVENT SELECTOR FOR BUYER */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] mr-1">
              Filtre Client :
            </span>
            <div className="flex items-center rounded-xl border border-slate-300 bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEventFilter('available');
                  if (availableEvents[0]) {
                    setSelectedEventId(availableEvents[0].id);
                    setCheckoutStep('form');
                  }
                }}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all flex items-center gap-1.5 ${
                  eventFilter === 'available'
                    ? 'border border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <span>Disponibles ({availableEvents.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEventFilter('past');
                  if (pastEvents[0]) {
                    setSelectedEventId(pastEvents[0].id);
                    setCheckoutStep('form');
                  }
                }}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all flex items-center gap-1.5 ${
                  eventFilter === 'past'
                    ? 'border border-amber-600 bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Antérieurs ({pastEvents.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setEventFilter('all')}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                  eventFilter === 'all'
                    ? 'border border-slate-800 bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                Tous ({allowedEvents.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600">
            {eventFilter === 'available' && (
              <span className="text-emerald-700 font-bold">● Vente ouverte : sélection et paiement immédiat</span>
            )}
            {eventFilter === 'past' && (
              <span className="text-amber-800 font-bold">● Vente close : consultation archive & historique</span>
            )}
            {eventFilter === 'all' && (
              <span>Affichage des événements disponibles & antérieurs</span>
            )}
          </div>
        </div>

        {/* Event buttons row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {displayedEvents.map((ev) => {
            const isPast = isEventPast(ev);
            const isSelected = currentEvent?.id === ev.id;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  setSelectedEventId(ev.id);
                  setCheckoutStep('form');
                }}
                className={`rounded-xl border-2 px-3 py-1.5 font-bold whitespace-nowrap transition-all shadow-2xs flex items-center gap-1.5 ${
                  isSelected
                    ? isPast
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-slate-800 bg-slate-800 text-white shadow-xs'
                    : isPast
                    ? 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isPast ? (
                  <span className={`rounded-md px-1 text-[10px] font-mono font-bold ${
                    isSelected ? 'bg-amber-700 text-amber-100' : 'bg-amber-200/70 text-amber-900'
                  }`}>
                    Passé
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <span>{ev.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: BUYER PURCHASE INTERFACE */}
      {buyerTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Event Hero Poster & Details */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border-2 border-sky-300 bg-white overflow-hidden shadow-md">
              {/* Event Poster Header */}
              <div className="relative aspect-4/3 w-full bg-linear-to-tr from-slate-950 via-slate-900 to-rose-950 p-6 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-200">
                    {currentEvent.category}
                  </span>
                  {isCurrentEventPast ? (
                    <span className="rounded-full border border-amber-300 bg-amber-500/30 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black text-amber-200 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-amber-300" />
                      Événement Antérieur (Clôturé)
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-400 bg-emerald-500/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Billetterie Ouverte
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h1 className="text-xl font-black leading-tight text-white drop-shadow-sm">
                    {currentEvent.title}
                  </h1>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-rose-400" />
                    <span>{currentEvent.venue} ({currentEvent.city})</span>
                  </p>
                </div>
              </div>

              {/* Event Key Facts */}
              <div className="p-5 space-y-3.5 text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-3 border-b border-sky-100 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-800 shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Date de l&apos;événement</span>
                    <div className="font-bold text-slate-900 text-sm">
                      {formatDateTime(currentEvent.eventDate)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-sky-100 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-800 shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Lieu & Accès</span>
                    <div className="font-bold text-slate-900">
                      {currentEvent.venue}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Ouverture des portes dès 16h00 · Pièce d&apos;identité requise
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Garantie Officielle KolaPass</span>
                    <div className="font-bold text-slate-900">
                      Billet Sécurisé Anti-Fraude
                    </div>
                    <div className="text-[11px] text-slate-500">
                      QR Code à usage unique avec renouvellement dynamique 30s.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stadium/Venue Perk Card */}
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/80 p-4 text-xs space-y-2">
              <span className="font-bold text-slate-900 uppercase text-[11px] block">
                Privilèges selon la catégorie choisie
              </span>
              <ul className="space-y-1.5 text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5" />
                  <span><strong>Standard</strong> : Accès gradins & tribunes générales, entrée Porte Ouest.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 mt-1.5" />
                  <span><strong>VIP</strong> : Pelouse or rapprochée, coupe-file Porte A, 1 boisson incluse.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5" />
                  <span><strong>VVIP</strong> : Salon lounge climatisé, buffet à volonté & place assise numérotée.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Interactive Booking & Mobile Money Payment OR Past Event Archive */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border-2 border-sky-300 bg-white p-6 shadow-md space-y-5">
              {/* If event is past (antérieur): locked archive consultation */}
              {isCurrentEventPast ? (
                <div className="space-y-5 text-xs">
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                      <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
                      <span>Billetterie Clôturée — Événement Antérieur</span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium leading-relaxed">
                      Cet événement a eu lieu le <strong>{formatDateTime(currentEvent.eventDate)}</strong>. 
                      Conformément aux règles de KolaPass, l&apos;acheteur n&apos;a le droit de réserver que pour les événements <strong>disponibles</strong>. 
                      Pour cet événement antérieur, vous pouvez consulter la fiche et vos billets existants.
                    </p>
                    <div className="pt-2 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-800">
                        Déjà titulaire d&apos;un pass pour cet événement ?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setBuyerTab('my_tickets');
                          setTicketFilter('past');
                        }}
                        className="rounded-xl border-2 border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-800 transition-colors shadow-2xs"
                      >
                        Consulter mes billets archivés →
                      </button>
                    </div>
                  </div>

                  {/* Archived Pricing Card */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                        Grille tarifaire clôturée (Historique)
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">100% écoulé</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {currentEvent.tiers.map((t) => (
                        <div key={t.id} className="rounded-xl border border-slate-300 bg-white p-3 text-center space-y-1">
                          <div className="font-extrabold text-xs text-slate-700">{t.name}</div>
                          <div className="font-mono text-sm font-black text-slate-900">
                            {formatMoney(t.priceUSD, displayCurrency, settings.rates)}
                          </div>
                          <div className="text-[10px] text-amber-800 font-bold bg-amber-100 rounded-md py-0.5">
                            Clôturé ({t.sold}/{t.capacity})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Disabled Action Button */}
                  <button
                    disabled
                    className="w-full rounded-2xl border-2 border-slate-300 bg-slate-200 py-3.5 text-xs font-black text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Achat de billet désactivé (Événement antérieur passé)</span>
                  </button>
                </div>
              ) : checkoutStep === 'form' ? (
                <form onSubmit={handleStartPayment} className="space-y-5 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                        1. Choisissez votre catégorie de place
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Places limitées
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {currentEvent.tiers.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTier(t.name)}
                          className={`rounded-2xl border-2 p-3 text-left transition-all relative ${
                            selectedTier === t.name
                              ? 'border-rose-600 bg-rose-50 text-rose-950 shadow-xs ring-1 ring-rose-500'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-extrabold text-xs">{t.name}</div>
                          <div className="mt-1 font-mono text-sm font-black text-rose-800">
                            {formatMoney(t.priceUSD, displayCurrency, settings.rates)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {t.capacity - t.sold} dispo
                          </div>
                          {selectedTier === t.name && (
                            <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white text-[9px] font-bold">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity & Guests */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-sky-100 pt-4">
                    <div>
                      <label className="font-extrabold text-slate-900 uppercase text-xs block mb-1">
                        2. Nombre de billets
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const q = Math.max(1, quantity - 1);
                            setQuantity(q);
                            setGuestNames((prev) => prev.slice(0, q));
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 font-black text-base hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="font-mono font-black text-lg text-slate-900 min-w-8 text-center">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const q = Math.min(10, quantity + 1);
                            setQuantity(q);
                            setGuestNames((prev) => {
                              const copy = [...prev];
                              while (copy.length < q) copy.push('');
                              return copy;
                            });
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 font-black text-base hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="font-extrabold text-slate-900 uppercase text-xs block mb-1">
                        Code Promo (ex: EARLYBIRD)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder="EARLYBIRD (-10%)"
                          className="w-full rounded-xl border-2 border-sky-200 px-3 py-1.5 font-mono text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 font-bold text-slate-800 hover:bg-slate-200"
                        >
                          OK
                        </button>
                      </div>
                      {promoMessage && (
                        <p className="mt-1 text-[11px] font-bold text-rose-700">
                          {promoMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Buyer Personal Details */}
                  <div className="space-y-3 border-t border-sky-100 pt-4">
                    <label className="font-extrabold text-slate-900 uppercase text-xs block">
                      3. Coordonnées de l&apos;Acheteur
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-slate-600 block mb-1">Nom complet</span>
                        <input
                          type="text"
                          required
                          value={buyerName}
                          onChange={(e) => {
                            setBuyerName(e.target.value);
                            setGuestNames((prev) => [e.target.value, ...prev.slice(1)]);
                          }}
                          className="w-full rounded-xl border-2 border-sky-200 px-3 py-2 text-xs font-bold text-slate-900"
                          placeholder="Ex: Grâce Lukunku"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-600 block mb-1">Numéro WhatsApp (pour le billet)</span>
                        <input
                          type="tel"
                          required
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                          className="w-full rounded-xl border-2 border-sky-200 px-3 py-2 font-mono text-xs font-bold text-slate-900"
                          placeholder="+243 81 000 0000"
                        />
                      </div>
                    </div>

                    {quantity > 1 && (
                      <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-3 mt-2">
                        <span className="font-bold text-slate-800 text-[11px] block">
                          Noms sur les billets supplémentaires ({quantity} personnes) :
                        </span>
                        {Array.from({ length: quantity }).map((_, i) => (
                          <input
                            key={i}
                            type="text"
                            value={guestNames[i] || ''}
                            onChange={(e) => {
                              const c = [...guestNames];
                              c[i] = e.target.value;
                              setGuestNames(c);
                            }}
                            placeholder={`Titulaire Billet #${i + 1} ${i === 0 ? '(Principal)' : ''}`}
                            className="w-full rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Network Selection */}
                  <div className="border-t border-sky-100 pt-4 space-y-2">
                    <label className="font-extrabold text-slate-900 uppercase text-xs block">
                      4. Mode de Paiement Mobile Money (Prélèvement instantané)
                    </label>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        'M-Pesa',
                        'Orange Money',
                        'Airtel Money',
                        'Wave',
                        'MTN MoMo',
                        'Visa / Mastercard',
                      ].map((rail) => (
                        <button
                          key={rail}
                          type="button"
                          onClick={() => setSelectedRail(rail as FintechRail)}
                          className={`rounded-xl border-2 p-2 text-center text-xs font-bold transition-all truncate ${
                            selectedRail === rail
                              ? 'border-slate-800 bg-slate-800 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {rail}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total & Checkout Button */}
                  <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 space-y-2 font-mono">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Sous-total ({quantity}x {selectedTier}) :</span>
                      <span>${subtotalUSD.toFixed(2)} USD</span>
                    </div>
                    {discountPercent > 0 && (
                      <div className="flex justify-between text-xs text-rose-700 font-bold">
                        <span>Réduction ({discountPercent}%) :</span>
                        <span>- ${discountUSD.toFixed(2)} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 border-t border-sky-200 pt-2">
                      <span>Montant total à débiter :</span>
                      <span className="text-base text-rose-800">
                        {formatMoney(totalUSD, displayCurrency, settings.rates)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-600 bg-rose-700 py-3.5 text-xs font-black text-white hover:bg-rose-800 transition-all shadow-md active:scale-98"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Payer {formatMoney(totalUSD, displayCurrency, settings.rates)} par {selectedRail}</span>
                  </button>
                </form>
              ) : null}

              {/* Step 2: USSD Push Phone Prompt Simulation */}
              {checkoutStep === 'ussd_pending' && (
                <div className="py-8 text-center space-y-4 animate-in fade-in">
                  <div className="relative mx-auto h-20 w-20">
                    <div className="h-20 w-20 rounded-full border-4 border-rose-200 border-t-rose-600 animate-spin" />
                    <Smartphone className="absolute inset-0 m-auto h-8 w-8 text-rose-700" />
                  </div>

                  <div className="space-y-1">
                    <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 font-mono text-[11px] font-bold text-rose-800">
                      USSD PUSH TRANSMIS
                    </span>
                    <h3 className="text-lg font-black text-slate-900 pt-2">
                      Validation sur votre téléphone mobile...
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Une invite de paiement de{' '}
                      <strong className="text-slate-900">
                        {formatMoney(totalUSD, displayCurrency, settings.rates)}
                      </strong>{' '}
                      a été envoyée sur votre compte{' '}
                      <strong className="text-rose-800">{selectedRail}</strong> ({buyerPhone}).
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-4 max-w-sm mx-auto text-xs text-slate-700 font-mono space-y-1">
                    <div className="text-[11px] text-slate-500">Aperçu message opérateur :</div>
                    <div className="font-bold text-slate-900">
                      « KolaPass demande {formatMoney(totalUSD, displayCurrency, settings.rates)}. Tapez votre code PIN secret pour confirmer. »
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Payment Success & Ticket Display */}
              {checkoutStep === 'success' && latestPass && (
                <div className="space-y-5 text-center animate-in zoom-in-95">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Félicitations, Paiement Confirmé !
                    </h3>
                    <p className="text-xs text-slate-500">
                      Vos {newlyIssuedPasses.length} pass officiels sont générés avec signature cryptographique.
                    </p>
                  </div>

                  {/* Attendee's Secure Mobile Pass Card (What they see on smartphone) */}
                  <div className="mx-auto max-w-sm rounded-3xl border-2 border-sky-300 bg-linear-to-b from-sky-50 via-white to-sky-50 p-5 shadow-lg text-left space-y-4">
                    <div className="text-center border-b border-dashed border-sky-200 pb-3">
                      <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-800">
                        {latestPass.tierName} PASS
                      </span>
                      <h4 className="mt-1 text-base font-black text-slate-900 leading-snug">
                        {latestPass.eventTitle}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {latestPass.venue} · {formatDateTime(latestPass.eventDate)}
                      </p>
                    </div>

                    {/* Anti-screenshot Dynamic QR Area */}
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-inner">
                      <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-500 pb-1">
                        <span className="flex items-center gap-1 text-sky-700 font-bold">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>QR DYNAMIQUE</span>
                        </span>
                        <span className="text-rose-700 font-bold">
                          Actualisé dans {secondsRemaining}s
                        </span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-rose-600 transition-all duration-1000 ease-linear"
                          style={{ width: `${(secondsRemaining / 30) * 100}%` }}
                        />
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-slate-200 relative">
                        <SvgQrCode value={latestPass.qrPayload || latestPass.passCode} size={170} />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="rounded-full bg-white/95 border border-sky-300 p-1.5 shadow-xs">
                            <ShieldCheck className="h-5 w-5 text-sky-700" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-center">
                        <div className="font-mono text-xs font-bold text-slate-900">
                          {latestPass.passCode}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Filigrane : <strong className="text-slate-800">{latestPass.holderName}</strong> · Porte A
                        </div>
                      </div>
                    </div>

                    {/* Attendee Info Card */}
                    <div className="rounded-xl border border-sky-200 bg-white p-3 flex items-center gap-3">
                      <img
                        src={
                          latestPass.avatarUrl || initialsAvatar(latestPass.holderName)
                        }
                        alt={latestPass.holderName}
                        className="h-10 w-10 rounded-full border border-sky-300 object-cover"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-900">{latestPass.holderName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{latestPass.holderPhone}</div>
                        <div className="text-[10px] text-emerald-700 font-bold">Payé via {latestPass.paymentRail}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions: WhatsApp & Download */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSendToWhatsApp(latestPass)}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-xs"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>M&apos;envoyer sur WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all"
                    >
                      <Printer className="h-4 w-4 text-slate-500" />
                      <span>Imprimer / PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCheckoutStep('form')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Acheter un autre billet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY TICKETS WALLET (PORTFEUILLE BILLETS DISPONIBLES & ANTÉRIEURS) */}
      {buyerTab === 'my_tickets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-sky-200 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Mon Portefeuille de Pass Sécurisés ({passes.length})
              </h2>
              <p className="text-xs text-slate-500">
                Vos billets pour les événements <strong>disponibles</strong> (à présenter à l&apos;entrée) et vos pass <strong>antérieurs</strong> (archivés).
              </p>
            </div>

            {/* Filter buttons for passes */}
            <div className="flex items-center rounded-xl border border-slate-300 bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setTicketFilter('all')}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  ticketFilter === 'all'
                    ? 'border border-slate-800 bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Tous ({passes.length})
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('active')}
                className={`rounded-lg px-3 py-1 font-bold transition-all flex items-center gap-1.5 ${
                  ticketFilter === 'active'
                    ? 'border border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <span>Actifs ({passes.filter((p) => new Date(p.eventDate).getTime() >= Date.now() && p.status !== 'used').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('past')}
                className={`rounded-lg px-3 py-1 font-bold transition-all flex items-center gap-1.5 ${
                  ticketFilter === 'past'
                    ? 'border border-amber-600 bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Antérieurs ({passes.filter((p) => new Date(p.eventDate).getTime() < Date.now() || p.status === 'used').length})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBuyerPasses.map((p) => {
              const isPastPass = new Date(p.eventDate).getTime() < Date.now() || p.status === 'used';
              return (
                <div
                  key={p.id}
                  className={`rounded-3xl border-2 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between transition-all ${
                    isPastPass
                      ? 'border-amber-300 hover:border-amber-400'
                      : 'border-sky-300 hover:border-sky-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-800">
                          {p.tierName} PASS
                        </span>
                        {isPastPass ? (
                          <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-amber-700" />
                            Antérieur
                          </span>
                        ) : (
                          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Actif
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {p.passCode}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-black text-slate-900 leading-snug">
                      {p.eventTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-rose-600" />
                      <span>{p.venue}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-sky-600" />
                      <span>{formatDateTime(p.eventDate)}</span>
                    </p>
                  </div>

                  {/* QR Miniature */}
                  <div className={`flex flex-col items-center justify-center rounded-2xl border p-3 ${
                    isPastPass ? 'border-amber-200 bg-amber-50/40' : 'border-sky-200 bg-sky-50/50'
                  }`}>
                    <SvgQrCode value={p.qrPayload || p.passCode} size={110} />
                    <span className="mt-1 font-mono text-[10px] text-slate-500">
                      Titulaire : <strong>{p.holderName}</strong>
                    </span>
                    {isPastPass && (
                      <span className="text-[10px] font-bold text-amber-800 mt-0.5 font-mono">
                        {p.status === 'used' ? '✓ Entrée Enregistrée (USED)' : '⏳ Événement Terminé (Archivé)'}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-sky-100 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendToWhatsApp(p)}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-400 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLatestPass(p);
                        setBuyerTab('checkout');
                        setCheckoutStep('success');
                      }}
                      className="rounded-xl border-2 border-slate-800 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                    >
                      Pass Plein Écran →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBuyerPasses.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              Aucun billet trouvé pour ce filtre ({ticketFilter}).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
