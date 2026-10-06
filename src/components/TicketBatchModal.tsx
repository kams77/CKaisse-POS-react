import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Eye,
  Layers,
  MapPin,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  EventTicketPass,
  StoreSettings,
  TicketBatchRange,
  TicketingEvent,
  UserSession,
} from '../types';
import { formatDateTime, formatMoney } from '../utils/format';

interface TicketBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'view';
  events: TicketingEvent[];
  selectedEventId?: string;
  inspectingBatch?: TicketBatchRange | null;
  batchPasses?: EventTicketPass[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  currentUserSession?: UserSession;
  onGenerateBatch: (payload: {
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
  onPrintBatch?: (batch: TicketBatchRange) => void;
  onTestScanPass?: (passCode: string) => void;
}

export const TicketBatchModal: React.FC<TicketBatchModalProps> = ({
  isOpen,
  onClose,
  mode,
  events,
  selectedEventId,
  inspectingBatch,
  batchPasses = [],
  displayCurrency,
  settings,
  currentUserSession,
  onGenerateBatch,
  onPrintBatch,
  onTestScanPass,
}) => {
  // Creation form state
  const defaultEventId = selectedEventId || events[0]?.id || '';
  const [formEventId, setFormEventId] = useState(defaultEventId);
  const selectedEvent = events.find((e) => e.id === formEventId) || events[0];

  const [formTierName, setFormTierName] = useState<'Standard' | 'VIP' | 'VVIP'>('VIP');
  const [formBatchName, setFormBatchName] = useState('');
  const [formPrefix, setFormPrefix] = useState('');
  const [formRangeMode, setFormRangeMode] = useState<'quantity' | 'range'>('quantity');
  const [formQuantity, setFormQuantity] = useState('50');
  const [formStartNum, setFormStartNum] = useState('1');
  const [formEndNum, setFormEndNum] = useState('50');
  const [formCustomUnitPrice, setFormCustomUnitPrice] = useState<string>('');
  const [formDistributorName, setFormDistributorName] = useState('Guichet Central — Billetterie Physique');
  const [formDistributorPhone, setFormDistributorPhone] = useState('+243 ');
  const [formNotes, setFormNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Pass list search in view mode
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'valid' | 'used'>('all');

  // Find tier and remaining capacity
  const currentTier = selectedEvent?.tiers.find((t) => t.name === formTierName);
  const availableCapacity = currentTier ? Math.max(0, currentTier.capacity - currentTier.sold) : 0;
  const standardPrice = currentTier ? currentTier.priceUSD : 25;
  const unitPrice = formCustomUnitPrice !== '' ? Number(formCustomUnitPrice) || 0 : standardPrice;

  // Auto-suggest prefix when event or tier changes
  const computedPrefix = useMemo(() => {
    if (!selectedEvent) return 'TKT';
    const cleanEvt = (selectedEvent.code || selectedEvent.title)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 5)
      .toUpperCase();
    return `${formTierName.slice(0, 3).toUpperCase()}-${cleanEvt}`;
  }, [selectedEvent, formTierName]);

  const activePrefix = formPrefix.trim() || computedPrefix;

  // Calculate actual numbers
  const calculatedStart = formRangeMode === 'quantity' ? 1 : Math.max(1, Number(formStartNum) || 1);
  const calculatedEnd =
    formRangeMode === 'quantity'
      ? Math.max(1, calculatedStart + (Number(formQuantity) || 1) - 1)
      : Math.max(calculatedStart, Number(formEndNum) || calculatedStart);
  const totalCount = calculatedEnd - calculatedStart + 1;
  const totalGrossUSD = totalCount * unitPrice;
  const commissionPercent = selectedEvent?.commissionRatePercent || 10.0;
  const commissionUSD = totalGrossUSD * (commissionPercent / 100);
  const netOrganizerUSD = totalGrossUSD - commissionUSD;

  // Auto-fill batch name placeholder if empty
  const defaultBatchTitle = useMemo(() => {
    if (!selectedEvent) return 'Plage de Billets';
    return `Plage ${formTierName} (${totalCount} places) — ${selectedEvent.title.slice(0, 30)}`;
  }, [selectedEvent, formTierName, totalCount]);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedEvent) {
      setErrorMsg('Veuillez sélectionner un événement.');
      return;
    }

    if (totalCount <= 0) {
      setErrorMsg('Le nombre de billets dans la plage doit être supérieur à zéro.');
      return;
    }

    if (totalCount > availableCapacity) {
      setErrorMsg(
        `Capacité insuffisante : La catégorie ${formTierName} ne dispose que de ${availableCapacity} places disponibles (${totalCount} demandées).`
      );
      return;
    }

    const finalName = formBatchName.trim() || defaultBatchTitle;
    const organizerName = currentUserSession?.name || selectedEvent.organizerName || 'Organisateur';

    try {
      const result = await onGenerateBatch({
        eventId: selectedEvent.id,
        tierName: formTierName,
        name: finalName,
        prefix: activePrefix,
        startNumber: calculatedStart,
        endNumber: calculatedEnd,
        unitPriceUSD: unitPrice,
        generatedBy: organizerName,
        distributorName: formDistributorName.trim() || undefined,
        distributorPhone: formDistributorPhone.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      if (result) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la génération de la plage de billets.');
    }
  };

  // Filtered passes for inspecting batch
  const filteredBatchPasses = useMemo(() => {
    return batchPasses.filter((p) => {
      if (ticketStatusFilter !== 'all' && p.status !== ticketStatusFilter) return false;
      if (ticketSearch.trim()) {
        const q = ticketSearch.toLowerCase();
        const matchCode = p.passCode.toLowerCase().includes(q);
        const matchHolder = p.holderName.toLowerCase().includes(q);
        const matchIndex = p.rangeIndex?.toString().includes(q);
        return matchCode || matchHolder || matchIndex;
      }
      return true;
    });
  }, [batchPasses, ticketStatusFilter, ticketSearch]);

  const handleExportCsv = () => {
    if (!inspectingBatch) return;
    const headers = [
      'N° Série',
      'Code Billet',
      'Catégorie',
      'Événement',
      'Plage Lot',
      'Prix USD',
      'Statut Entrée',
      'Émargé à',
      'Porte',
    ];
    const rows = batchPasses.map((p) => [
      p.rangeIndex || '',
      p.passCode,
      p.tierName,
      `"${p.eventTitle.replace(/"/g, '""')}"`,
      `"${inspectingBatch.name.replace(/"/g, '""')}"`,
      p.pricePaidUSD,
      p.status === 'used' ? 'Scanné (Entré)' : p.status === 'valid' ? 'Valide (Non scanné)' : p.status,
      p.checkedInAt ? new Date(p.checkedInAt).toLocaleString('fr-FR') : '-',
      p.checkedInGate || '-',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Plage-Billets-${inspectingBatch.batchNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl border-2 border-sky-300 bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-sky-100 bg-gradient-to-r from-sky-50 via-white to-rose-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-sky-400 bg-sky-500 text-white shadow-xs">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {mode === 'create'
                  ? 'Générer une Plage de Billets (Lot de Places Vendues)'
                  : `Détails & Suivi de la Plage ${inspectingBatch?.batchNumber || ''}`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'create'
                  ? 'Émission en série de tickets physiques ou de guichet — Décomptés et comptabilisés comme VENDUS'
                  : inspectingBatch?.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-slate-200 bg-white p-2 text-slate-400 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {mode === 'create' ? (
            <form onSubmit={handleSubmitCreate} className="space-y-5">
              {/* Educational Highlight Card */}
              <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/70 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sky-950 font-bold text-xs">
                  <Sparkles className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>FONCTIONNEMENT & RÈGLE DE COMPTABILISATION :</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Lorsque l&apos;organisateur génère une plage de billets (ex: 50 ou 200 places), le système
                  <strong> déduit instantanément ces places de la capacité de l&apos;événement</strong> et les
                  <strong> enregistre au Dashboard comme places VENDUES</strong> (recettes brutes et commissions
                  comptabilisées). Chaque billet individuel généré possède son QR code scannable au portique et
                  est vérifié à l&apos;entrée avant l&apos;accès du client.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Event & Category Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Événement concerné *
                  </label>
                  <select
                    value={formEventId}
                    onChange={(e) => setFormEventId(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    {events
                      .filter((e) => e.status !== 'completed')
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} ({e.city})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catégorie de place *
                  </label>
                  <select
                    value={formTierName}
                    onChange={(e) =>
                      setFormTierName(e.target.value as 'Standard' | 'VIP' | 'VVIP')
                    }
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    {selectedEvent?.tiers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} — {formatMoney(t.priceUSD, displayCurrency, settings.rates)} ({t.capacity - t.sold} dispo)
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] font-mono text-slate-500">
                    Capacité restante : <strong className="text-slate-900">{availableCapacity} places</strong> sur {currentTier?.capacity || 0}
                  </div>
                </div>
              </div>

              {/* Batch Name & Prefix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Désignation / Nom du Lot de Billets *
                  </label>
                  <input
                    type="text"
                    value={formBatchName}
                    onChange={(e) => setFormBatchName(e.target.value)}
                    placeholder={defaultBatchTitle}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">
                    ex: &quot;Guichet Stade Martyrs — Tribune VIP (Lot A)&quot; ou &quot;Partenaire Vodacom&quot;
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Préfixe Série des Billets *
                  </label>
                  <input
                    type="text"
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value.toUpperCase())}
                    placeholder={computedPrefix}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none uppercase"
                  />
                  <span className="text-[10px] text-slate-400">
                    ex: VIP-STM, PLG-01, TKT-01
                  </span>
                </div>
              </div>

              {/* Range Configuration (Mode: Quantity or Range) */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Définition de la Plage Numérique :
                  </span>
                  <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setFormRangeMode('quantity')}
                      className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                        formRangeMode === 'quantity'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Par Quantité (ex: 50)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormRangeMode('range')}
                      className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                        formRangeMode === 'range'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      De N° à N° (ex: 101 à 250)
                    </button>
                  </div>
                </div>

                {formRangeMode === 'quantity' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre de billets à générer :
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={availableCapacity || 500}
                        value={formQuantity}
                        onChange={(e) => setFormQuantity(e.target.value)}
                        className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Numéro de départ de la série :
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formStartNum}
                        onChange={(e) => setFormStartNum(e.target.value)}
                        className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Numéro de début de la plage :
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formStartNum}
                        onChange={(e) => setFormStartNum(e.target.value)}
                        className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Numéro de fin de la plage :
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formEndNum}
                        onChange={(e) => setFormEndNum(e.target.value)}
                        className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Live Preview Box of Ticket Code Range */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300 bg-sky-100/60 p-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-sky-800 shrink-0" />
                    <span>
                      Plage : <strong>N° {calculatedStart}</strong> à <strong>N° {calculatedEnd}</strong> ({totalCount} billets)
                    </span>
                  </div>
                  <div className="text-slate-700 font-bold">
                    Aperçu : <span className="text-rose-700">{activePrefix}-{String(calculatedStart).padStart(4, '0')}</span> →{' '}
                    <span className="text-rose-700">{activePrefix}-{String(calculatedEnd).padStart(4, '0')}</span>
                  </div>
                </div>
              </div>

              {/* Price & Distributor Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prix unitaire USD ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCustomUnitPrice !== '' ? formCustomUnitPrice : standardPrice}
                    onChange={(e) => setFormCustomUnitPrice(e.target.value)}
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">
                    Par défaut : tarif catégorie ({standardPrice} $)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Point de Vente / Guichetier
                  </label>
                  <input
                    type="text"
                    value={formDistributorName}
                    onChange={(e) => setFormDistributorName(e.target.value)}
                    placeholder="ex: Guichetier Paul M."
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Téléphone Guichet
                  </label>
                  <input
                    type="text"
                    value={formDistributorPhone}
                    onChange={(e) => setFormDistributorPhone(e.target.value)}
                    placeholder="+243 81 ..."
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Financial Accounting Summary Card */}
              <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/50 p-4 space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900">
                  Comptabilisation Automatique au Dashboard Admin :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-mono">
                  <div className="rounded-xl border border-rose-200 bg-white p-2.5">
                    <span className="text-[10px] font-sans font-bold text-slate-500 uppercase">
                      Recettes Brutes Vendues
                    </span>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {formatMoney(totalGrossUSD, displayCurrency, settings.rates)}
                    </div>
                    <div className="text-[10px] text-slate-500">{totalCount} places × {unitPrice} $</div>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-white p-2.5">
                    <span className="text-[10px] font-sans font-bold text-slate-500 uppercase">
                      Commission KolaPass ({commissionPercent}%)
                    </span>
                    <div className="text-lg font-black text-rose-700 mt-0.5">
                      +{formatMoney(commissionUSD, displayCurrency, settings.rates)}
                    </div>
                    <div className="text-[10px] text-slate-500">Prélèvement plateforme</div>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-white p-2.5">
                    <span className="text-[10px] font-sans font-bold text-slate-500 uppercase">
                      Net Reversé Promoteur
                    </span>
                    <div className="text-lg font-black text-emerald-700 mt-0.5">
                      {formatMoney(netOrganizerUSD, displayCurrency, settings.rates)}
                    </div>
                    <div className="text-[10px] text-slate-500">Solde dû à l&apos;organisateur</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={totalCount <= 0 || totalCount > availableCapacity}
                  className={`inline-flex items-center gap-2 rounded-xl border-2 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all ${
                    totalCount <= 0 || totalCount > availableCapacity
                      ? 'border-slate-300 bg-slate-400 cursor-not-allowed'
                      : 'border-rose-600 bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>
                    Confirmer l&apos;Émission & Comptabiliser {totalCount} Place(s) Vendue(s)
                  </span>
                </button>
              </div>
            </form>
          ) : inspectingBatch ? (
            /* VIEW MODE: DETAILED BATCH INSPECTION & TICKET LIST */
            <div className="space-y-5">
              {/* Batch KPI Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="rounded-2xl border-2 border-sky-300 bg-white p-3 shadow-2xs">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500">
                    Places Émises
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {inspectingBatch.quantity}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    N° {inspectingBatch.startNumber} à {inspectingBatch.endNumber}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-emerald-300 bg-white p-3 shadow-2xs">
                  <span className="text-[10px] font-sans font-bold uppercase text-emerald-800">
                    Scannés à l&apos;Entrée
                  </span>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {inspectingBatch.scannedCount} / {inspectingBatch.quantity}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-sans">
                    {Math.round((inspectingBatch.scannedCount / inspectingBatch.quantity) * 100)}% de présence
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-sky-300 bg-white p-3 shadow-2xs">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500">
                    Valeur Comptabilisée
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {formatMoney(inspectingBatch.totalValueUSD, displayCurrency, settings.rates)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    {inspectingBatch.unitPriceUSD} $ / place
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-rose-300 bg-white p-3 shadow-2xs">
                  <span className="text-[10px] font-sans font-bold uppercase text-rose-800">
                    Statut Plage
                  </span>
                  <div className="text-base font-black text-rose-900 mt-1 uppercase">
                    Comptabilisé Vendu
                  </div>
                  <div className="text-[10px] text-rose-700 font-sans">
                    Vérifiable au portique
                  </div>
                </div>
              </div>

              {/* Batch Metadata Card */}
              <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/60 p-4 space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="font-bold">Événement :</span> {inspectingBatch.eventTitle}
                  </div>
                  <div>
                    <span className="font-bold">Catégorie :</span>{' '}
                    <span className="rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                      {inspectingBatch.tierName}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">Généré par :</span> {inspectingBatch.generatedBy}
                  </div>
                  <div>
                    <span className="font-bold">Date émission :</span>{' '}
                    <span className="font-mono">{formatDateTime(inspectingBatch.generatedAt)}</span>
                  </div>
                  {inspectingBatch.distributorName && (
                    <div className="sm:col-span-2">
                      <span className="font-bold">Point de vente / Guichetier :</span>{' '}
                      {inspectingBatch.distributorName}{' '}
                      {inspectingBatch.distributorPhone && `(${inspectingBatch.distributorPhone})`}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-rose-700" />
                  <h3 className="text-sm font-black text-slate-900">
                    Billets Individuels Générés ({batchPasses.length})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPrintBatch?.(inspectingBatch)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-sky-400 bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 transition-colors shadow-2xs"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Imprimer la Planche de Billets</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-800 transition-colors shadow-2xs"
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    <span>Exporter CSV</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter within Batch Passes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Filtrer par code (ex: VIP-RUMBA-0001)..."
                    className="w-full rounded-xl border-2 border-sky-200 bg-white pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-100 p-1">
                  {[
                    { id: 'all', label: 'Tous' },
                    { id: 'valid', label: 'Valides (Non scannés)' },
                    { id: 'used', label: 'Scannés (Émargés)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTicketStatusFilter(f.id as any)}
                      className={`flex-1 rounded-lg py-1 text-center font-bold text-xs transition-colors ${
                        ticketStatusFilter === f.id
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passes Mini Table */}
              <div className="overflow-x-auto rounded-xl border-2 border-sky-200 max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-sky-200 bg-sky-50 font-bold text-slate-700 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">N° Série</th>
                      <th className="p-2.5">Code Billet (QR)</th>
                      <th className="p-2.5">Porteur / Guichet</th>
                      <th className="p-2.5">Statut Vérification</th>
                      <th className="p-2.5 text-right">Action Test Scan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100 font-medium font-mono text-[11px]">
                    {filteredBatchPasses.length > 0 ? (
                      filteredBatchPasses.map((p) => (
                        <tr key={p.id} className="hover:bg-sky-50/60">
                          <td className="p-2.5 font-bold text-slate-900">
                            #{p.rangeIndex || '-'}
                          </td>
                          <td className="p-2.5 font-bold text-rose-800">
                            {p.passCode}
                          </td>
                          <td className="p-2.5 font-sans text-slate-700 truncate max-w-[150px]">
                            {p.holderName}
                          </td>
                          <td className="p-2.5">
                            {p.status === 'used' ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 font-sans">
                                <Clock className="h-3 w-3 text-slate-500" />
                                Émargé ({p.checkedInGate || 'Entrée'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 font-sans">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Valide (Prêt)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                onTestScanPass?.(p.passCode);
                                onClose();
                              }}
                              className="rounded-lg border-2 border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:border-slate-800 hover:bg-slate-100 shadow-2xs transition-colors"
                            >
                              Tester Scan Portique
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500 font-sans">
                          Aucun billet ne correspond à votre filtre.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
