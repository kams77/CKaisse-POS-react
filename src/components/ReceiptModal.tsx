import React, { useState } from 'react';
import {
  Check,
  Copy,
  HeartPulse,
  MessageSquare,
  Printer,
  Scissors,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { CurrencyCode, SaleRecord, StoreSettings } from '../types';
import { formatDateTime, formatMoney } from '../utils/format';

interface ReceiptModalProps {
  sale: SaleRecord;
  settings: StoreSettings;
  displayCurrency: CurrencyCode;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  settings,
  displayCurrency,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const paymentLabel =
    sale.paymentMethod === 'cash'
      ? 'Espèces (Cash)'
      : sale.paymentMethod === 'mobile_money'
      ? `Mobile Money (${sale.mobileOperator || 'Opérateur'})`
      : sale.paymentMethod === 'card'
      ? 'Carte Bancaire (TPE)'
      : 'Crédit Client / Facturation';

  const isPharma = sale.sector === 'pharmacy';
  const isSalon = sale.sector === 'salon';

  const buildWhatsAppText = () => {
    const lines = [
      `*${settings.storeName.toUpperCase()}*`,
      isPharma
        ? `[PHARMACIE & DÉPÔT PHARMACEUTIQUE]`
        : `[SALON DE COIFFURE & INSTITUT DE BEAUTÉ]`,
      `Reçu N°: ${sale.receiptNumber}`,
      `Date: ${formatDateTime(sale.createdAt)}`,
      `Client/Patient: ${sale.customerName}`,
      isPharma && settings.pharmacyLicenseNumber
        ? `Agrément Ordre Pharmaciens: ${settings.pharmacyLicenseNumber}`
        : null,
      isPharma && sale.prescriptionRef
        ? `Ordonnance: ${sale.prescriptionRef}`
        : null,
      isPharma && sale.prescribingDoctor
        ? `Médecin: ${sale.prescribingDoctor}`
        : null,
      isSalon && sale.assignedStylist
        ? `Styliste: ${sale.assignedStylist}`
        : null,
      `----------------------------`,
      ...sale.items.map((item) => {
        const itemLine = `${item.quantity}x ${item.name} — ${formatMoney(
          item.lineTotalUSD,
          displayCurrency,
          settings.rates
        )}`;
        const meta = [
          item.dosage,
          item.batchNumber ? `Lot: ${item.batchNumber}` : null,
          item.expiryDate ? `Exp: ${item.expiryDate}` : null,
          item.assignedStylist ? `Styliste: ${item.assignedStylist.split('(')[0]}` : null,
        ].filter(Boolean).join(' · ');

        return meta ? `${itemLine}\n  (${meta})` : itemLine;
      }),
      `----------------------------`,
      `Sous-total HT: ${formatMoney(
        sale.subtotalUSD,
        displayCurrency,
        settings.rates
      )}`,
      sale.discountUSD > 0
        ? `Remise: -${formatMoney(
            sale.discountUSD,
            displayCurrency,
            settings.rates
          )}`
        : null,
      `TVA (${settings.taxRatePercent}%): ${formatMoney(
        sale.taxUSD,
        displayCurrency,
        settings.rates
      )}`,
      isSalon && sale.tipAmountUSD && sale.tipAmountUSD > 0
        ? `Pourboire Styliste: ${formatMoney(
            sale.tipAmountUSD,
            displayCurrency,
            settings.rates
          )}`
        : null,
      `*TOTAL PAYÉ: ${formatMoney(
        sale.totalUSD,
        displayCurrency,
        settings.rates
      )}*`,
      `Mode de règlement: ${paymentLabel}`,
      sale.transactionRef ? `Réf: ${sale.transactionRef}` : null,
      `----------------------------`,
      isPharma
        ? `Conseil: Conservez les médicaments à l'abri de l'humidité. Respectez la posologie médicale.`
        : `Conseil: Prenez soin de votre chevelure. Merci de votre confiance au salon !`,
      settings.receiptFooter,
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(buildWhatsAppText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanPhone = (sale.customerPhone || sale.mobilePhone || '').replace(
    /[^0-9]/g,
    ''
  );
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    buildWhatsAppText()
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            {isPharma ? (
              <HeartPulse className="h-4 w-4 text-emerald-600" />
            ) : (
              <Scissors className="h-4 w-4 text-amber-600" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Ticket Officiel {isPharma ? 'Pharmacie' : 'Salon de Coiffure'}
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                {sale.receiptNumber} · {sale.status === 'refunded' ? 'ANNULÉ / REMBOURSÉ' : 'PAYÉ ET VALIDÉ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable thermal receipt paper */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-5">
          <div
            id="printable-receipt"
            className="mx-auto w-full max-w-[340px] rounded-md border border-slate-200 bg-white p-5 text-xs text-slate-900 shadow-xs font-mono tabular-nums"
          >
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="text-sm font-bold tracking-tight uppercase">
                {settings.storeName}
              </div>
              <div className="mt-0.5 text-[10px] font-bold tracking-wider text-slate-700 uppercase">
                {isPharma
                  ? 'Officine & Dépôt Pharmaceutique'
                  : 'Salon de Coiffure & Beauté Prestige'}
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                {settings.address}
              </div>
              <div className="text-[11px] text-slate-600">
                Tél: {settings.phone}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {settings.taxId}
              </div>
              {isPharma && settings.pharmacyLicenseNumber && (
                <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                  Agrément Ordre : {settings.pharmacyLicenseNumber}
                </div>
              )}
            </div>

            {/* Receipt Meta */}
            <div className="my-3 space-y-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">TICKET:</span>
                <span className="font-semibold">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DATE:</span>
                <span>{formatDateTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CAISSIER:</span>
                <span className="truncate max-w-[170px]">{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {isPharma ? 'PATIENT / CLIENT:' : 'CLIENT:'}
                </span>
                <span className="font-medium truncate max-w-[170px]">
                  {sale.customerName}
                </span>
              </div>

              {/* Pharma specific prescription fields */}
              {isPharma && sale.prescriptionRef && (
                <div className="flex justify-between text-purple-900 font-medium">
                  <span>ORDONNANCE:</span>
                  <span className="truncate max-w-[170px]">{sale.prescriptionRef}</span>
                </div>
              )}
              {isPharma && sale.prescribingDoctor && (
                <div className="flex justify-between text-slate-600">
                  <span>MÉDECIN:</span>
                  <span className="truncate max-w-[170px]">{sale.prescribingDoctor}</span>
                </div>
              )}

              {/* Salon specific fields */}
              {isSalon && sale.assignedStylist && (
                <div className="flex justify-between text-amber-900 font-medium">
                  <span>STYLISTE RÉFÉRENT:</span>
                  <span className="truncate max-w-[170px]">{sale.assignedStylist.split('(')[0]}</span>
                </div>
              )}
            </div>

            {/* Items list */}
            <div className="space-y-2.5 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                <span>DÉSIGNATION</span>
                <span>TOTAL</span>
              </div>

              {sale.items.map((item, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="font-medium text-slate-900 leading-snug">
                    {item.name}
                  </div>

                  {/* Pharmacie item specifics */}
                  {isPharma && (item.dosage || item.batchNumber || item.expiryDate) && (
                    <div className="text-[10px] text-slate-500">
                      {[
                        item.dosage,
                        item.batchNumber ? `Lot ${item.batchNumber}` : null,
                        item.expiryDate ? `Exp ${item.expiryDate}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}

                  {/* Salon item specifics */}
                  {isSalon && (item.salonTier || item.assignedStylist) && (
                    <div className="text-[10px] text-slate-500">
                      {[
                        item.salonTier ? `Gamme ${item.salonTier}` : null,
                        item.assignedStylist ? `Coiffé par ${item.assignedStylist.split('(')[0]}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600 mt-0.5">
                    <span>
                      {item.quantity} x{' '}
                      {formatMoney(
                        item.unitPriceUSD,
                        displayCurrency,
                        settings.rates
                      )}
                      {item.discountPercent > 0
                        ? ` (-${item.discountPercent}%)`
                        : ''}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(
                        item.lineTotalUSD,
                        displayCurrency,
                        settings.rates
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="my-3 space-y-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-600">Sous-total HT:</span>
                <span>
                  {formatMoney(sale.subtotalUSD, displayCurrency, settings.rates)}
                </span>
              </div>

              {sale.discountUSD > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Remise commerciale:</span>
                  <span>
                    -{formatMoney(sale.discountUSD, displayCurrency, settings.rates)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-600">
                  TVA ({settings.taxRatePercent}%):
                </span>
                <span>
                  {formatMoney(sale.taxUSD, displayCurrency, settings.rates)}
                </span>
              </div>

              {isSalon && sale.tipAmountUSD && sale.tipAmountUSD > 0 && (
                <div className="flex justify-between text-amber-900">
                  <span>Pourboire Styliste VIP:</span>
                  <span>
                    +{formatMoney(sale.tipAmountUSD, displayCurrency, settings.rates)}
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-1 text-sm font-bold text-slate-900">
                <span>NET À PAYER:</span>
                <span>
                  {formatMoney(sale.totalUSD, displayCurrency, settings.rates)}
                </span>
              </div>

              {displayCurrency !== 'CDF' && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Équivalent CDF:</span>
                  <span>
                    {formatMoney(sale.totalUSD, 'CDF', settings.rates)}
                  </span>
                </div>
              )}
              {displayCurrency !== 'USD' && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Équivalent USD:</span>
                  <span>
                    {formatMoney(sale.totalUSD, 'USD', settings.rates)}
                  </span>
                </div>
              )}
            </div>

            {/* Payment details */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Règlement:</span>
                <span className="font-semibold">{paymentLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant reçu:</span>
                <span>
                  {formatMoney(
                    sale.amountTenderedUSD,
                    displayCurrency,
                    settings.rates
                  )}
                </span>
              </div>
              {sale.changeDueUSD > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Monnaie rendue:</span>
                  <span>
                    {formatMoney(
                      sale.changeDueUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </span>
                </div>
              )}
              {sale.transactionRef && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Réf transaction:</span>
                  <span className="font-mono">{sale.transactionRef}</span>
                </div>
              )}
            </div>

            {/* Footer advice */}
            <div className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center text-[10px] text-slate-500 space-y-1">
              {isPharma ? (
                <div className="text-slate-700 italic">
                  Médicaments contrôlés. Conservez à l'abri de l'humidité et de la lumière. Respectez la posologie médicale.
                </div>
              ) : (
                <div className="text-slate-700 italic">
                  Prenez soin de votre chevelure. Merci de votre confiance au salon !
                </div>
              )}
              <div>{settings.receiptFooter}</div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="border-t border-slate-200 bg-white p-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 px-3 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer (80mm)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-500" />
                  <span>Copier Texte</span>
                </>
              )}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
