import React, { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
  Smartphone,
  UserCheck,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  Customer,
  MobileMoneyOperator,
  PaymentMethod,
  StoreSettings,
} from '../types';
import { convertFromUSD, convertToUSD, formatMoney } from '../utils/format';

interface PaymentModalProps {
  totalUSD: number;
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  selectedCustomer: Customer | null;
  onClose: () => void;
  onConfirmPayment: (details: {
    paymentMethod: PaymentMethod;
    mobileOperator?: MobileMoneyOperator;
    mobilePhone?: string;
    transactionRef?: string;
    amountTenderedUSD: number;
    changeDueUSD: number;
    note?: string;
  }) => void;
}

const OPERATORS: MobileMoneyOperator[] = [
  'M-Pesa',
  'Orange Money',
  'Airtel Money',
  'Wave',
  'MTN MoMo',
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  totalUSD,
  displayCurrency,
  settings,
  selectedCustomer,
  onClose,
  onConfirmPayment,
}) => {
  const totalInDisplayCurrency = convertFromUSD(
    totalUSD,
    displayCurrency,
    settings.rates
  );

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashEntered, setCashEntered] = useState<string>(
    displayCurrency === 'CDF' || displayCurrency === 'XOF'
      ? Math.ceil(totalInDisplayCurrency).toString()
      : totalInDisplayCurrency.toFixed(2)
  );
  const [operator, setOperator] = useState<MobileMoneyOperator>('M-Pesa');
  const [mobilePhone, setMobilePhone] = useState<string>(
    selectedCustomer?.phone || '+243 '
  );
  const [mobileMode, setMobileMode] = useState<'ussd' | 'qr'>('ussd');
  const [ussdState, setUssdState] = useState<'idle' | 'pending' | 'approved'>(
    'idle'
  );
  const [cardRef, setCardRef] = useState<string>(
    `TPE-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [note, setNote] = useState<string>('');

  const numericCash = parseFloat(cashEntered) || 0;
  const amountTenderedUSD =
    method === 'cash'
      ? convertToUSD(numericCash, displayCurrency, settings.rates)
      : totalUSD;

  const changeDueUSD =
    method === 'cash' ? Math.max(0, amountTenderedUSD - totalUSD) : 0;

  const isCashSufficient =
    method !== 'cash' || amountTenderedUSD >= totalUSD - 0.005;

  const canUseCredit = Boolean(selectedCustomer);

  const handleSendUssdPush = () => {
    if (!mobilePhone.trim()) return;
    setUssdState('pending');
    setTimeout(() => {
      setUssdState('approved');
    }, 1200);
  };

  const handleComplete = () => {
    if (method === 'cash' && !isCashSufficient) return;
    if (method === 'credit' && !canUseCredit) return;

    const generatedRef =
      method === 'mobile_money'
        ? `${operator.slice(0, 2).toUpperCase()}-${Date.now()
            .toString()
            .slice(-6)}`
        : method === 'card'
        ? cardRef
        : undefined;

    onConfirmPayment({
      paymentMethod: method,
      mobileOperator: method === 'mobile_money' ? operator : undefined,
      mobilePhone: method === 'mobile_money' ? mobilePhone : undefined,
      transactionRef: generatedRef,
      amountTenderedUSD: method === 'cash' ? amountTenderedUSD : totalUSD,
      changeDueUSD,
      note: note.trim() || undefined,
    });
  };

  const quickAmounts =
    displayCurrency === 'USD' || displayCurrency === 'EUR'
      ? [
          Math.ceil(totalInDisplayCurrency),
          Math.ceil(totalInDisplayCurrency / 5) * 5,
          Math.ceil(totalInDisplayCurrency / 10) * 10 + 10,
          50,
          100,
        ]
      : [
          Math.ceil(totalInDisplayCurrency / 1000) * 1000,
          Math.ceil(totalInDisplayCurrency / 5000) * 5000,
          Math.ceil(totalInDisplayCurrency / 10000) * 10000 + 10000,
        ];

  const uniqueQuickAmounts = Array.from(new Set(quickAmounts)).filter(
    (val) => val >= totalInDisplayCurrency
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Finaliser l&apos;encaissement
            </h2>
            <p className="text-xs text-slate-500">
              Client :{' '}
              <span className="font-medium text-slate-800">
                {selectedCustomer ? selectedCustomer.name : 'Client Comptoir'}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount banner */}
          <div className="flex flex-wrap items-baseline justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <span className="text-xs font-medium text-slate-500">
                Net à encaisser ({displayCurrency})
              </span>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {formatMoney(totalUSD, displayCurrency, settings.rates)}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums text-xs text-slate-500 space-y-0.5">
              <div>USD: {formatMoney(totalUSD, 'USD', settings.rates)}</div>
              <div>CDF: {formatMoney(totalUSD, 'CDF', settings.rates)}</div>
              <div>XOF: {formatMoney(totalUSD, 'XOF', settings.rates)}</div>
            </div>
          </div>

          {/* Payment method selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Mode de règlement
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setMethod('cash')}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                  method === 'cash'
                    ? 'border-emerald-600 bg-emerald-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Banknote className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  Espèces (Cash)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('mobile_money')}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                  method === 'mobile_money'
                    ? 'border-emerald-600 bg-emerald-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  Mobile Money
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                  method === 'card'
                    ? 'border-emerald-600 bg-emerald-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  Carte / TPE
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('credit')}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                  method === 'credit'
                    ? 'border-emerald-600 bg-emerald-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  Crédit Client
                </span>
              </button>
            </div>
          </div>

          {/* Method specific panel */}
          {method === 'cash' && (
            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Montant remis par le client ({displayCurrency})
                </label>
                <input
                  type="number"
                  step="any"
                  value={cashEntered}
                  onChange={(e) => setCashEntered(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base font-semibold font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {uniqueQuickAmounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Billets rapides :</span>
                  {uniqueQuickAmounts.slice(0, 4).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashEntered(amt.toString())}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono tabular-nums font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      {amt.toLocaleString('fr-FR')} {displayCurrency}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-xs font-medium text-slate-600">
                  Monnaie à rendre au client :
                </span>
                <div className="text-right font-mono tabular-nums">
                  <div
                    className={`text-base font-bold ${
                      isCashSufficient ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {isCashSufficient
                      ? formatMoney(
                          changeDueUSD,
                          displayCurrency,
                          settings.rates
                        )
                      : 'Montant insuffisant'}
                  </div>
                  {isCashSufficient && displayCurrency !== 'CDF' && (
                    <div className="text-[11px] text-slate-500">
                      Soit {formatMoney(changeDueUSD, 'CDF', settings.rates)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {method === 'mobile_money' && (
            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Choisir l&apos;opérateur Mobile Money
                </span>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMobileMode('ussd')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      mobileMode === 'ussd'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Push USSD
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMode('qr')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      mobileMode === 'qr'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    QR Code Caisse
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {OPERATORS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => {
                      setOperator(op);
                      setUssdState('idle');
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      operator === op
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>

              {mobileMode === 'ussd' ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Numéro de téléphone du client ({operator})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={mobilePhone}
                        onChange={(e) => setMobilePhone(e.target.value)}
                        placeholder="+243 81 000 0000"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSendUssdPush}
                        disabled={ussdState === 'pending'}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {ussdState === 'pending' ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Attente PIN...</span>
                          </>
                        ) : (
                          <span>Envoyer Push USSD</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {ussdState === 'approved' && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Confirmation {operator} reçue pour{' '}
                        <strong className="font-mono">{mobilePhone}</strong>.
                        Vous pouvez valider le ticket.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white p-2">
                    <QrCode className="h-16 w-16 text-slate-900" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-slate-900">
                      QR Code Marchand {operator}
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Le client scanne ce code depuis son application {operator}{' '}
                      pour régler exactement{' '}
                      <strong className="font-mono">
                        {formatMoney(totalUSD, displayCurrency, settings.rates)}
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {method === 'card' && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <label className="block text-xs font-medium text-slate-700">
                Référence d&apos;autorisation Terminal TPE (Visa / Mastercard)
              </label>
              <input
                type="text"
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              <p className="text-xs text-slate-500">
                Passez la carte sur le lecteur TPE bancaire puis vérifiez le
                numéro d&apos;autorisation ci-dessus.
              </p>
            </div>
          )}

          {method === 'credit' && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-4">
              {canUseCredit && selectedCustomer ? (
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-900">
                    Inscription au compte crédit de : {selectedCustomer.name}
                  </div>
                  <div className="text-slate-600 font-mono tabular-nums">
                    Solde dû actuel :{' '}
                    {formatMoney(
                      selectedCustomer.creditBalanceUSD,
                      displayCurrency,
                      settings.rates
                    )}{' '}
                    → Nouveau solde après vente :{' '}
                    <strong className="text-amber-700">
                      {formatMoney(
                        selectedCustomer.creditBalanceUSD + totalUSD,
                        displayCurrency,
                        settings.rates
                      )}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-medium text-amber-800">
                  Veuillez d&apos;abord sélectionner un client identifié dans le
                  panier (à droite) pour autoriser une vente à crédit.
                </div>
              )}
            </div>
          )}

          {/* Optional note */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Note sur le ticket (optionnel)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Livraison à domicile, garantie 6 mois..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={
              (method === 'cash' && !isCashSufficient) ||
              (method === 'credit' && !canUseCredit)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Valider l&apos;encaissement (
              {formatMoney(totalUSD, displayCurrency, settings.rates)})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
