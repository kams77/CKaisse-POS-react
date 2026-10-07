import React, { useEffect, useState } from 'react';
import { SvgQrCode } from './SvgQrCode';
import { formatDateTime } from '../utils/format';

interface TicketView {
  organizationName: string;
  passCode: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  tierName: string;
  holderName: string;
  status: 'valid' | 'used' | 'blacklisted' | 'cancelled';
  qrPayload: string;
  checkedInAt: string | null;
}

/** Page publique d'un billet (lien envoyé à l'acheteur par WhatsApp, SMS ou e-mail). */
export const PublicTicket: React.FC = () => {
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    fetch(`/api/public/ticket?c=${encodeURIComponent(q.get('c') || '')}&s=${encodeURIComponent(q.get('s') || '')}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'Billet introuvable.');
        return r.json();
      })
      .then(setTicket)
      .catch(e => setError(e.message || 'Billet introuvable.'));
  }, []);

  const statusLabel: Record<TicketView['status'], [string, string]> = {
    valid: ['Billet valide', 'border-emerald-400 bg-emerald-50 text-emerald-900'],
    used: ['Déjà utilisé', 'border-slate-400 bg-slate-100 text-slate-800'],
    blacklisted: ['Billet bloqué', 'border-rose-400 bg-rose-50 text-rose-900'],
    cancelled: ['Billet annulé', 'border-rose-400 bg-rose-50 text-rose-900'],
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-sky-50 to-blue-50 p-4">
      <div className="w-full max-w-sm rounded-3xl border-2 border-sky-300 bg-white p-6 shadow-xl text-center space-y-4">
        {error && <p role="alert" className="text-sm font-bold text-rose-800">{error}</p>}
        {!error && !ticket && <p className="text-sm text-slate-500">Chargement du billet…</p>}
        {ticket && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-800">{ticket.organizationName || 'KolaPass'}</p>
            <h1 className="text-lg font-black text-slate-950">{ticket.eventTitle}</h1>
            <p className="text-xs text-slate-600">{ticket.venue} — {formatDateTime(ticket.eventDate)}</p>
            <div className="flex justify-center">
              <SvgQrCode value={ticket.qrPayload} size={240} />
            </div>
            <p className="font-mono text-sm font-bold tracking-wider">{ticket.passCode}</p>
            <p className="text-sm"><strong>{ticket.holderName}</strong> · {ticket.tierName}</p>
            <p className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${statusLabel[ticket.status][1]}`}>
              {statusLabel[ticket.status][0]}
              {ticket.status === 'used' && ticket.checkedInAt ? ` le ${formatDateTime(ticket.checkedInAt)}` : ''}
            </p>
            <p className="text-[11px] text-slate-500">Présentez ce QR code à l'entrée. Il n'est valable qu'une seule fois : ne le partagez pas.</p>
          </>
        )}
      </div>
    </div>
  );
};
