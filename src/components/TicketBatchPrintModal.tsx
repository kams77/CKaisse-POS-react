import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  Printer,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { CurrencyCode, EventTicketPass, StoreSettings, TicketBatchRange } from '../types';
import { formatDateTime, formatMoney } from '../utils/format';
import { SvgQrCode } from './SvgQrCode';

interface TicketBatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: TicketBatchRange | null;
  passes: EventTicketPass[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
}

export const TicketBatchPrintModal: React.FC<TicketBatchPrintModalProps> = ({
  isOpen,
  onClose,
  batch,
  passes,
  displayCurrency,
  settings,
}) => {
  const [ticketLayout, setTicketLayout] = useState<'stub' | 'grid'>('stub');

  if (!isOpen || !batch) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const headers = [
      'N° Série',
      'Code Billet',
      'Catégorie',
      'Événement',
      'Plage Lot',
      'Prix USD',
      'Statut Entrée',
    ];
    const rows = passes.map((p) => [
      p.rangeIndex || '',
      p.passCode,
      p.tierName,
      `"${p.eventTitle.replace(/"/g, '""')}"`,
      `"${batch.name.replace(/"/g, '""')}"`,
      p.pricePaidUSD,
      p.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Planche-Billets-${batch.batchNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      {/* Container with print-specific handling */}
      <div className="relative w-full max-w-5xl rounded-3xl border-2 border-sky-300 bg-white shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Top Bar - Hidden during print */}
        <div className="print:hidden flex flex-wrap items-center justify-between border-b-2 border-sky-100 bg-slate-50 px-6 py-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-rose-600 bg-rose-700 text-white shadow-xs">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Planche d&apos;Impression — Billets Physiques ({batch.batchNumber})
              </h2>
              <p className="text-xs text-slate-500">
                {batch.name} · {passes.length} billet(s) scannable(s) avec talon détachable
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1 text-xs">
              <button
                type="button"
                onClick={() => setTicketLayout('stub')}
                className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                  ticketLayout === 'stub' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Format Talon Découpage
              </button>
              <button
                type="button"
                onClick={() => setTicketLayout('grid')}
                className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                  ticketLayout === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Grille Compacte
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-800 transition-colors shadow-2xs"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer la Planche</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-200 bg-white p-1.5 text-slate-400 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 print:bg-white print:p-0">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Sheet Header Summary (Hidden in print if desired) */}
            <div className="print:hidden rounded-2xl border-2 border-sky-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                    LOT OFFICIEL : {batch.batchNumber}
                  </span>
                  <span className="font-bold text-slate-800">{batch.eventTitle}</span>
                </div>
                <div className="text-slate-500 font-mono">
                  Plage : N° {batch.startNumber} à N° {batch.endNumber} ({batch.quantity} places) · Catégorie {batch.tierName}
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-slate-500 font-sans">Valeur Totale Comptabilisée</div>
                <div className="text-base font-black text-slate-900">
                  {formatMoney(batch.totalValueUSD, displayCurrency, settings.rates)}
                </div>
              </div>
            </div>

            {/* Ticket Cards Stream */}
            <div className={ticketLayout === 'stub' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
              {passes.map((pass) => (
                <div
                  key={pass.id}
                  className="rounded-2xl border-2 border-slate-300 bg-white overflow-hidden shadow-xs print:shadow-none print:border-slate-800 print:break-inside-avoid transition-all flex flex-col sm:flex-row"
                >
                  {/* Left Section: Main Ticket Body */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md border border-slate-900 bg-slate-900 px-2 py-0.5 text-[9px] font-black text-white tracking-widest uppercase">
                            KOLAPASS OFFICIEL
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              pass.tierName === 'VVIP'
                                ? 'border-amber-400 bg-amber-100 text-amber-950'
                                : pass.tierName === 'VIP'
                                ? 'border-rose-400 bg-rose-100 text-rose-950'
                                : 'border-sky-300 bg-sky-100 text-sky-950'
                            }`}
                          >
                            ACCÈS {pass.tierName}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                            N° {String(pass.rangeIndex || 1).padStart(4, '0')} / {pass.rangeTotal}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 mt-1 leading-snug">
                          {pass.eventTitle}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Tarif Guichet</div>
                        <div className="text-base font-black text-rose-700 font-mono">
                          {formatMoney(pass.pricePaidUSD, displayCurrency, settings.rates)}
                        </div>
                      </div>
                    </div>

                    {/* Event logistics details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-sky-600 shrink-0" />
                        <span className="font-mono font-medium">{formatDateTime(pass.eventDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-rose-600 shrink-0" />
                        <span className="truncate">{pass.venue}</span>
                      </div>
                    </div>

                    {/* Bottom Security Footer */}
                    <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-[10px] font-mono text-slate-500">
                      <div>
                        <span>Lot : <strong>{batch.batchNumber}</strong></span>
                        <span className="mx-1.5">·</span>
                        <span>Code : <strong className="text-slate-900">{pass.passCode}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-800 font-sans font-bold">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Usage Unique au Scan</span>
                      </div>
                    </div>
                  </div>

                  {/* Perforated Separator (Dotted line with Scissors) */}
                  <div className="relative flex sm:flex-col items-center justify-center border-t-2 sm:border-t-0 sm:border-l-2 border-dashed border-slate-300 bg-slate-50/50 p-2 sm:w-44 shrink-0">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 sm:top-1/2 sm:-left-3 sm:-translate-y-1/2 h-5 w-5 rounded-full bg-slate-100 sm:bg-slate-100 border border-slate-300 print:hidden" />

                    <div className="flex flex-col items-center text-center space-y-1 p-2 w-full">
                      <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                        <Scissors className="h-3 w-3" />
                        <span>Talon Contrôle</span>
                      </div>

                      {/* Crisp Scannable QR Code */}
                      <div className="bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                        <SvgQrCode value={pass.passCode} size={92} />
                      </div>

                      <div className="font-mono font-black text-xs text-rose-800 mt-1">
                        {pass.passCode}
                      </div>
                      <div className="text-[9px] font-bold text-slate-500">
                        Billet #{pass.rangeIndex}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
