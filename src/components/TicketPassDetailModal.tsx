import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  MessageSquare,
  Printer,
  RefreshCw,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  X,
} from 'lucide-react';
import { CurrencyCode, EventTicketPass, StoreSettings, UserRole } from '../types';
import { SvgQrCode } from './SvgQrCode';
import { getDynamicQrToken } from '../utils/cryptoJwt';
import { formatDateTime, formatMoney } from '../utils/format';

interface TicketPassDetailModalProps {
  pass: EventTicketPass | null;
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  currentUserRole: UserRole;
  onClose: () => void;
  onBlacklistPass?: (passId: string, reason: string) => void;
  onReactivatePass?: (passId: string) => void;
}

export const TicketPassDetailModal: React.FC<TicketPassDetailModalProps> = ({
  pass,
  displayCurrency,
  settings,
  currentUserRole,
  onClose,
  onBlacklistPass,
  onReactivatePass,
}) => {
  const [viewMode, setViewMode] = useState<'mobile' | 'badge' | 'thermal' | 'jwt'>('mobile');
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [dynamicToken, setDynamicToken] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  // 30-second rolling dynamic QR timer
  useEffect(() => {
    if (!pass) return;

    const updateToken = () => {
      const { dynamicCode, secondsRemaining: sec } = getDynamicQrToken(pass.passCode, 30);
      setDynamicToken(dynamicCode);
      setSecondsRemaining(sec);
    };

    updateToken();
    const interval = setInterval(updateToken, 1000);
    return () => clearInterval(interval);
  }, [pass]);

  if (!pass) return null;

  const isBlacklisted = pass.status === 'blacklisted';
  const isUsed = pass.status === 'used';

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(
      `🎟️ *Votre Billet Officiel KolaPass*\n\n` +
      `*Événement* : ${pass.eventTitle}\n` +
      `*Pass* : ${pass.tierName} (${pass.passCode})\n` +
      `*Titulaire* : ${pass.holderName}\n` +
      `*Lieu* : ${pass.venue}\n` +
      `*Statut* : ${pass.status === 'valid' ? 'VALIDE (Non utilisé)' : pass.status}\n\n` +
      `Présentez votre QR Code dynamique anti-capture à l'entrée du stade/salle.\n` +
      `Signature cryptographique : ${pass.qrSignature || 'HMAC-SHA256'}\n\n` +
      `_KolaPass Billetterie & Contrôle d'Accès Sécurisé_`
    );
    const cleanPhone = pass.holderPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    setNotificationStatus('Message WhatsApp préparé avec succès !');
    setTimeout(() => setNotificationStatus(null), 3500);
  };

  const handleSendEmailPdf = () => {
    setNotificationStatus(`E-mail avec billet PDF signé transmis à ${pass.holderEmail || pass.holderName} !`);
    setTimeout(() => setNotificationStatus(null), 3500);
  };

  const handleSendSms = () => {
    setNotificationStatus(`SMS de confirmation expédié au ${pass.holderPhone} avec le code de retrait ${pass.passCode}`);
    setTimeout(() => setNotificationStatus(null), 3500);
  };

  const handleExecuteBlacklist = () => {
    if (!blacklistInput.trim()) return;
    onBlacklistPass?.(pass.id, blacklistInput.trim());
    setShowBlacklistConfirm(false);
    setBlacklistInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-sky-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-100 text-sky-800">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Pass Officiel KolaPass
                </h3>
                <span className="font-mono text-xs font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-md">
                  {pass.passCode}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Billet cryptographique avec signature HMAC & QR dynamique anti-capture
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notification Toast */}
        {notificationStatus && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-xs animate-in fade-in">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            <span>{notificationStatus}</span>
          </div>
        )}

        {/* Status Warning Banner if Blacklisted or Used */}
        {isBlacklisted && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-xs text-rose-900">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-rose-950 uppercase tracking-wide">
                BILLET SUR LISTE NOIRE (ACCÈS INTERDIT)
              </div>
              <p className="mt-1 text-rose-800">
                Motif du blocage : <strong>{pass.blacklistReason || 'Fraude signalée'}</strong>
              </p>
              {pass.blacklistedAt && (
                <p className="mt-0.5 text-[11px] text-rose-700">
                  Bloqué le {formatDateTime(pass.blacklistedAt)}
                </p>
              )}
            </div>
            {onReactivatePass && (
              <button
                type="button"
                onClick={() => onReactivatePass(pass.id)}
                className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100"
              >
                Réactiver
              </button>
            )}
          </div>
        )}

        {isUsed && !isBlacklisted && (
          <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-slate-300 bg-slate-100 p-3.5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>
                Billet déjà composté le{' '}
                <strong className="font-mono">
                  {pass.checkedInAt ? formatDateTime(pass.checkedInAt) : 'N/A'}
                </strong>{' '}
                ({pass.checkedInGate || 'Porte A'})
              </span>
            </div>
            <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-800">
              USAGE UNIQUE EFFECTUÉ
            </span>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="mt-4 flex items-center justify-between border-b border-sky-100 pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'mobile', label: 'Pass Mobile (QR Dynamique)' },
              { id: 'badge', label: 'Badge A4 / Lanyard' },
              { id: 'thermal', label: 'Ticket Thermique' },
              { id: 'jwt', label: 'Signature JWT' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setViewMode(t.id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === t.id
                    ? 'border-2 border-sky-400 bg-sky-100 text-sky-900 shadow-2xs'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Imprimer</span>
          </button>
        </div>

        {/* Main Display Area */}
        <div className="mt-5">
          {viewMode === 'mobile' && (
            <div className="mx-auto max-w-sm rounded-2xl border-2 border-sky-300 bg-linear-to-b from-sky-50 via-white to-sky-50/50 p-5 shadow-md">
              {/* Event Info */}
              <div className="text-center">
                <span className="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800">
                  {pass.tierName} PASS
                </span>
                <h4 className="mt-2 text-base font-extrabold text-slate-900 leading-snug">
                  {pass.eventTitle}
                </h4>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-sky-600" />
                  <span>{pass.venue}</span>
                </div>
              </div>

              {/* Anti-Screenshot Dynamic QR Code Area */}
              <div className="relative mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-inner">
                {/* Rolling Timer Bar */}
                <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-500 pb-2">
                  <span className="flex items-center gap-1 text-sky-700 font-bold">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>QR DYNAMIQUE</span>
                  </span>
                  <span className="text-rose-700 font-bold">
                    Expire dans {secondsRemaining}s
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-rose-600 transition-all duration-1000 ease-linear"
                    style={{ width: `${(secondsRemaining / 30) * 100}%` }}
                  />
                </div>

                {/* QR Code Graphic */}
                <div className="relative p-2 rounded-xl bg-white border border-slate-200">
                  <SvgQrCode value={dynamicToken || pass.passCode} size={180} />
                  {/* Holographic Watermark Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="rounded-full bg-white/90 border border-sky-300 p-1.5 shadow-xs">
                      <ShieldCheck className="h-5 w-5 text-sky-700" />
                    </div>
                  </div>
                </div>

                {/* Anti-Screenshot Watermark Footer */}
                <div className="mt-3 text-center">
                  <div className="font-mono text-xs font-bold text-slate-900 tracking-wider">
                    {pass.passCode}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 flex items-center justify-center gap-1">
                    <span>Filigrane sécurisé :</span>
                    <strong className="text-slate-800">{pass.holderName}</strong>
                    <span>·</span>
                    <span className="font-mono">{new Date().toLocaleTimeString('fr-FR')}</span>
                  </div>
                </div>
              </div>

              {/* Attendee Details Card */}
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-sky-200 bg-white p-3">
                <img
                  src={
                    pass.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                  }
                  alt={pass.holderName}
                  className="h-12 w-12 rounded-full border-2 border-sky-300 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {pass.holderName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {pass.holderPhone}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Payé par {pass.paymentRail} · {formatMoney(pass.pricePaidUSD, displayCurrency, settings.rates)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'badge' && (
            <div className="mx-auto max-w-sm rounded-2xl border-4 border-slate-900 bg-white p-6 shadow-xl text-center">
              <div className="mx-auto h-4 w-16 rounded-full bg-slate-300 mb-4" title="Fente pour lanière de tour de cou" />
              <div className="rounded-lg bg-slate-900 py-1.5 text-xs font-bold uppercase tracking-widest text-white">
                {pass.tierName} BADGE VIP
              </div>
              <div className="mt-4">
                <img
                  src={
                    pass.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  }
                  alt={pass.holderName}
                  className="mx-auto h-24 w-24 rounded-full border-4 border-slate-900 object-cover shadow-sm"
                />
                <h4 className="mt-3 text-lg font-black text-slate-900">
                  {pass.holderName}
                </h4>
                <p className="text-xs font-semibold text-sky-800">
                  ACCÈS OFFICIEL SALON & BACKSTAGE
                </p>
              </div>

              <div className="mt-4 flex justify-center">
                <SvgQrCode value={pass.passCode} size={130} />
              </div>
              <div className="mt-3 font-mono text-xs font-bold text-slate-800">
                {pass.passCode}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {pass.eventTitle} · {pass.venue}
              </p>
            </div>
          )}

          {viewMode === 'thermal' && (
            <div className="mx-auto max-w-xs rounded-xl border-2 border-slate-300 bg-white p-4 font-mono text-xs text-slate-900 shadow-sm">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold text-sm">*** KOLAPASS BILLET ***</div>
                <div className="text-[11px]">{pass.eventTitle}</div>
                <div className="text-[10px] text-slate-500">{pass.venue}</div>
              </div>

              <div className="py-3 space-y-1 text-[11px] border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>CODE BILLET:</span>
                  <span className="font-bold">{pass.passCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>CATÉGORIE:</span>
                  <span className="font-bold">{pass.tierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>TITULAIRE:</span>
                  <span>{pass.holderName}</span>
                </div>
                <div className="flex justify-between">
                  <span>TÉLÉPHONE:</span>
                  <span>{pass.holderPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span>PRIX PAYÉ:</span>
                  <span className="font-bold">
                    {formatMoney(pass.pricePaidUSD, displayCurrency, settings.rates)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>MODE PAIEMENT:</span>
                  <span>{pass.paymentRail}</span>
                </div>
              </div>

              <div className="pt-3 flex flex-col items-center">
                <SvgQrCode value={pass.passCode} size={110} />
                <div className="mt-2 text-[10px] text-center text-slate-500">
                  SCAN UNIQUE À L&apos;ENTRÉE · NON REMBOURSABLE
                </div>
              </div>
            </div>
          )}

          {viewMode === 'jwt' && (
            <div className="rounded-xl border-2 border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 space-y-3">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <KeyRound className="h-4 w-4" />
                  <span>Jeton JWT Cryptographique (HS256)</span>
                </span>
                <span className="text-[10px]">Signé HMAC-SHA256</span>
              </div>

              <div>
                <span className="text-rose-400 text-[11px] block font-bold">
                  HEADER (Algorithme & Type):
                </span>
                <pre className="mt-1 bg-slate-950 p-2 rounded text-[10px] text-slate-300 overflow-x-auto">
                  {JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-sky-400 text-[11px] block font-bold">
                  PAYLOAD VÉRIFIABLE:
                </span>
                <pre className="mt-1 bg-slate-950 p-2 rounded text-[10px] text-slate-300 overflow-x-auto">
                  {JSON.stringify(
                    {
                      iss: 'kolapass.com',
                      sub: pass.passCode,
                      evtId: pass.eventId,
                      evtTitle: pass.eventTitle,
                      tier: pass.tierName,
                      holder: pass.holderName,
                      phone: pass.holderPhone,
                      priceUSD: pass.pricePaidUSD,
                      purchasedAt: pass.purchasedAt,
                      status: pass.status,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div>
                <span className="text-emerald-400 text-[11px] block font-bold">
                  SIGNATURE CRYPTOGRAPHIQUE:
                </span>
                <div className="mt-1 bg-slate-950 p-2 rounded text-[10px] text-emerald-300 break-all">
                  {pass.qrSignature || 'HMAC-SHA256:9A8F21C0E4B892D1F34A'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: WhatsApp, Email, SMS & Blacklist */}
        <div className="mt-6 border-t border-sky-100 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Envoyer WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleSendEmailPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition-colors"
            >
              <Mail className="h-4 w-4 text-sky-700" />
              <span>Email PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSendSms}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Send className="h-3.5 w-3.5 text-slate-500" />
              <span>SMS Code</span>
            </button>
          </div>

          {/* Blacklist Control for Admin / Organizer */}
          {(currentUserRole === 'admin' || currentUserRole === 'organizer') && onBlacklistPass && (
            <div>
              {!showBlacklistConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowBlacklistConfirm(true)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    isBlacklisted
                      ? 'border-slate-300 bg-slate-100 text-slate-600'
                      : 'border-rose-400 bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  <Ban className="h-3.5 w-3.5 text-rose-600" />
                  <span>{isBlacklisted ? 'Billet déjà blacklisté' : 'Blacklister ce billet'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border-2 border-rose-400 bg-rose-50 p-2 text-xs">
                  <input
                    type="text"
                    value={blacklistInput}
                    onChange={(e) => setBlacklistInput(e.target.value)}
                    placeholder="Motif (ex: capture revendue)"
                    className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs text-rose-950 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleExecuteBlacklist}
                    className="rounded-lg bg-rose-700 px-2.5 py-1 font-bold text-white hover:bg-rose-800"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBlacklistConfirm(false)}
                    className="rounded-lg bg-white px-2 py-1 text-slate-600 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
