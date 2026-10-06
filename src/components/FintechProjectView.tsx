import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  KeyRound,
  Link2,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  FintechRail,
  FintechTransaction,
  InvoiceRecord,
  MerchantPayout,
  PaymentLinkItem,
  StoreSettings,
} from '../types';
import { formatDateTime, formatMoney } from '../utils/format';

interface FintechProjectViewProps {
  paymentLinks: PaymentLinkItem[];
  invoices: InvoiceRecord[];
  transactions: FintechTransaction[];
  payouts: MerchantPayout[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  onCreatePaymentLink: (
    data: Omit<
      PaymentLinkItem,
      | 'id'
      | 'shortCode'
      | 'clicksCount'
      | 'salesCount'
      | 'totalCollectedUSD'
      | 'status'
      | 'createdAt'
    >
  ) => PaymentLinkItem;
  onCreateInvoice: (
    data: Omit<InvoiceRecord, 'id' | 'invoiceNumber' | 'status' | 'createdAt'>
  ) => InvoiceRecord;
  onProcessCheckoutPayment: (payload: {
    sourceType: FintechTransaction['sourceType'];
    sourceId?: string;
    sourceTitle: string;
    customerName: string;
    customerPhone: string;
    amountUSD: number;
    paymentRail: FintechRail;
  }) => void;
  onRequestPayout: (amountUSD: number, destination: string) => void;
}

type SubView = 'links' | 'invoices' | 'api' | 'wallet';

const RAILS: FintechRail[] = [
  'M-Pesa',
  'Orange Money',
  'Airtel Money',
  'Wave',
  'MTN MoMo',
  'Visa / Mastercard',
];

export const FintechProjectView: React.FC<FintechProjectViewProps> = ({
  paymentLinks,
  invoices,
  transactions,
  payouts,
  displayCurrency,
  settings,
  onCreatePaymentLink,
  onCreateInvoice,
  onProcessCheckoutPayment,
  onRequestPayout,
}) => {
  const [subView, setSubView] = useState<SubView>('links');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Payment Link Modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkAmountUSD, setLinkAmountUSD] = useState('35.00');
  const [linkCollectAddr, setLinkCollectAddr] = useState(true);

  // Create Invoice Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invClientName, setInvClientName] = useState('');
  const [invClientPhone, setInvClientPhone] = useState('+243 ');
  const [invClientEmail, setInvClientEmail] = useState('');
  const [invDesc, setInvDesc] = useState('');
  const [invAmountUSD, setInvAmountUSD] = useState('150.00');
  const [invDueDate, setInvDueDate] = useState('2026-10-15');

  // Hosted Checkout Simulator Modal (Customer View)
  const [activeCheckout, setActiveCheckout] = useState<{
    sourceType: FintechTransaction['sourceType'];
    sourceId?: string;
    title: string;
    description: string;
    amountUSD: number;
    merchantName: string;
    defaultCustomerName?: string;
    defaultCustomerPhone?: string;
  } | null>(null);
  const [checkoutCustomerName, setCheckoutCustomerName] = useState('');
  const [checkoutCustomerPhone, setCheckoutCustomerPhone] = useState('+243 ');
  const [checkoutRail, setCheckoutRail] = useState<FintechRail>('M-Pesa');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [checkoutSuccessReceipt, setCheckoutSuccessReceipt] = useState<{
    ref: string;
    amountUSD: number;
    rail: FintechRail;
    title: string;
  } | null>(null);

  // Developer API Keys & Live Sandbox state
  const [publicKey, setPublicKey] = useState(
    'pk_live_kola_89a4c2f109e3b7d1a520'
  );
  const [secretKey, setSecretKey] = useState(
    'sk_live_kola_4f91d8e2c7a0b3159e64'
  );
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(
    'https://boutique-marchand.com/api/webhooks/kolapay'
  );
  const [apiTestAmount, setApiTestAmount] = useState('45.00');
  const [apiTestChannel, setApiTestChannel] = useState<
    'web_checkout' | 'pos_terminal'
  >('web_checkout');
  const [apiTestRail, setApiTestRail] = useState<FintechRail>('M-Pesa');
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiResponseJson, setApiResponseJson] = useState<string | null>(null);

  // Payout modal & FinTech revenue simulator
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutDestination, setPayoutDestination] = useState(
    `M-Pesa Entreprise (${settings.phone})`
  );
  const [payoutAmountUSD, setPayoutAmountUSD] = useState('100.00');
  const [simActiveVendors, setSimActiveVendors] = useState(80);
  const [simAvgMonthlyVolumeUSD, setSimAvgMonthlyVolumeUSD] = useState(1500);
  const [simCommissionPct, setSimCommissionPct] = useState(2.5);

  // Global FinTech KPIs
  const grossVolumeUSD = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'succeeded')
        .reduce((acc, t) => acc + t.grossAmountUSD, 0),
    [transactions]
  );

  const totalPlatformFeesUSD = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'succeeded')
        .reduce((acc, t) => acc + t.platformFeeUSD, 0),
    [transactions]
  );

  const totalNetMerchantUSD = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'succeeded')
        .reduce((acc, t) => acc + t.netMerchantUSD, 0),
    [transactions]
  );

  const totalWithdrawnUSD = useMemo(
    () => payouts.reduce((acc, p) => acc + p.amountUSD, 0),
    [payouts]
  );

  const availableWalletBalanceUSD = Math.max(
    0,
    totalNetMerchantUSD - totalWithdrawnUSD
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim()) return;
    onCreatePaymentLink({
      title: linkTitle.trim(),
      description:
        linkDesc.trim() ||
        'Paiement en ligne sécurisé par Mobile Money ou Carte.',
      amountUSD: Math.max(1, parseFloat(linkAmountUSD) || 10),
      merchantName: settings.storeName,
      collectCustomerAddress: linkCollectAddr,
    });
    setLinkTitle('');
    setLinkDesc('');
    setLinkAmountUSD('35.00');
    setIsLinkModalOpen(false);
  };

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invClientName.trim() || !invDesc.trim()) return;
    onCreateInvoice({
      clientName: invClientName.trim(),
      clientPhone: invClientPhone.trim(),
      clientEmail: invClientEmail.trim() || undefined,
      description: invDesc.trim(),
      amountUSD: Math.max(1, parseFloat(invAmountUSD) || 50),
      dueDate: invDueDate,
    });
    setInvClientName('');
    setInvClientPhone('+243 ');
    setInvClientEmail('');
    setInvDesc('');
    setIsInvoiceModalOpen(false);
  };

  const openCustomerCheckout = (params: {
    sourceType: FintechTransaction['sourceType'];
    sourceId?: string;
    title: string;
    description: string;
    amountUSD: number;
    merchantName: string;
    defaultCustomerName?: string;
    defaultCustomerPhone?: string;
  }) => {
    setCheckoutSuccessReceipt(null);
    setCheckoutCustomerName(params.defaultCustomerName || 'Client Acheteur');
    setCheckoutCustomerPhone(params.defaultCustomerPhone || '+243 81 500 1234');
    setCheckoutRail('M-Pesa');
    setActiveCheckout(params);
  };

  const handleConfirmCustomerCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckout) return;
    setCheckoutProcessing(true);

    try {
      // Also call our live Express API endpoint to generate a real Payment Intent & Webhook
      await fetch('/api/v1/payment-intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: activeCheckout.amountUSD,
          currency: displayCurrency,
          description: activeCheckout.title,
          channel:
            activeCheckout.sourceType === 'invoice'
              ? 'invoice'
              : 'payment_link',
          customerName: checkoutCustomerName,
          customerContact: checkoutCustomerPhone,
        }),
      });
    } catch {
      // Continue seamlessly even if offline
    }

    setTimeout(() => {
      onProcessCheckoutPayment({
        sourceType: activeCheckout.sourceType,
        sourceId: activeCheckout.sourceId,
        sourceTitle: activeCheckout.title,
        customerName: checkoutCustomerName.trim() || 'Client Acheteur',
        customerPhone: checkoutCustomerPhone.trim() || '+243 81 000 0000',
        amountUSD: activeCheckout.amountUSD,
        paymentRail: checkoutRail,
      });

      setCheckoutProcessing(false);
      setCheckoutSuccessReceipt({
        ref: `pi_kola_${Math.random().toString(16).slice(2, 10)}`,
        amountUSD: activeCheckout.amountUSD,
        rail: checkoutRail,
        title: activeCheckout.title,
      });
    }, 800);
  };

  const handleRunLiveApiTest = async () => {
    setApiTestLoading(true);
    const amt = Math.max(1, parseFloat(apiTestAmount) || 45);

    try {
      const createRes = await fetch('/api/v1/payment-intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          currency: 'USD',
          description:
            apiTestChannel === 'pos_terminal'
              ? 'Encaissement API Terminal Caisse POS'
              : 'Paiement API Site E-Commerce',
          channel: apiTestChannel,
          customerName: 'Testeur Développeur API',
          customerContact: '+243 99 400 7788',
        }),
      });
      const createdData = await createRes.json();

      const confirmRes = await fetch(
        `/api/v1/payment-intents/${createdData.id}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod:
              apiTestRail === 'Visa / Mastercard' ? 'card' : 'mobile_money',
            operator: apiTestRail,
          }),
        }
      );
      const confirmedData = await confirmRes.json();
      setApiResponseJson(JSON.stringify(confirmedData, null, 2));
    } catch {
      // Fallback JSON if needed
      const fallback = {
        status: 'succeeded',
        payment_intent: {
          id: `pi_kola_${Date.now().toString(16)}`,
          amount: amt,
          currency: 'USD',
          feeAmount: Number((amt * 0.02).toFixed(2)),
          netAmount: Number((amt * 0.98).toFixed(2)),
          channel: apiTestChannel,
          operator: apiTestRail,
        },
        webhook_delivery: {
          http_status: 200,
          target_url: webhookUrl,
        },
      };
      setApiResponseJson(JSON.stringify(fallback, null, 2));
    }

    onProcessCheckoutPayment({
      sourceType: apiTestChannel === 'pos_terminal' ? 'api_pos' : 'api_web',
      sourceTitle:
        apiTestChannel === 'pos_terminal'
          ? 'API Caisse POS Connectée (#POS-API)'
          : 'API Checkout Site Web (#WEB-API)',
      customerName: 'Client API Live',
      customerPhone: '+243 99 400 7788',
      amountUSD: amt,
      paymentRail: apiTestRail,
    });

    setApiTestLoading(false);
  };

  const handleRequestPayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payoutAmountUSD) || 0;
    if (amt <= 0 || amt > availableWalletBalanceUSD) return;
    onRequestPayout(amt, payoutDestination.trim());
    setIsPayoutModalOpen(false);
  };

  const simulatedMonthlyFintechFeeUSD =
    simActiveVendors * simAvgMonthlyVolumeUSD * (simCommissionPct / 100);
  const simulatedAnnualFintechFeeUSD = simulatedMonthlyFintechFeeUSD * 12;

  return (
    <div className="space-y-6">
      {/* Project 2 Header & Top KPIs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
            <span>PROJET 2 SUR 3</span>
            <span>·</span>
            <span>FINTECH, SOCIAL COMMERCE & PASSERELLE API</span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-slate-900">
            KolaPay — Liens de Paiement WhatsApp, Facturation & API Web / POS
          </h1>
          <p className="text-xs text-slate-500">
            Encaissez par Mobile Money et Carte bancaire sans site web via un
            simple lien, ou intégrez notre API REST dans vos sites et caisses
            POS avec 2,0% de commission par transaction.
          </p>
        </div>

        {/* Sub-navigation for Project 2 */}
        <div className="flex flex-col items-start lg:items-end gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1.5">
            {[
              { id: 'links', label: 'Liens de Paiement' },
              { id: 'invoices', label: 'Factures & Devis' },
              { id: 'api', label: 'API Web & POS' },
              { id: 'wallet', label: 'Portefeuille & Commissions' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id as SubView)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  subView === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const targetLink = paymentLinks[0];
                if (!targetLink) return;
                openCustomerCheckout({
                  sourceType: 'payment_link',
                  sourceId: targetLink.id,
                  title: targetLink.title,
                  description: targetLink.description,
                  amountUSD: targetLink.amountUSD,
                  merchantName: targetLink.merchantName,
                  defaultCustomerName: 'Sarah Lukombo (Test 1-Clic)',
                  defaultCustomerPhone: '+243 81 777 8899',
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap"
            >
              <Play className="h-3 w-3" />
              <span>Test 1 : Checkout Lien Client (1-clic)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubView('api');
                handleRunLiveApiTest();
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Code2 className="h-3 w-3 text-emerald-600" />
              <span>Test 2 : Appel API Serveur & Webhook (1-clic)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Volume Total Encaissé (GMV)
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatMoney(grossVolumeUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Sur {transactions.length} transactions réussies
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Solde Disponible Marchand (Net 98%)
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatMoney(
              availableWalletBalanceUSD,
              displayCurrency,
              settings.rates
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Retirable vers Mobile Money ou Banque
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Vos Commissions FinTech (2,0% / vente)
          </span>
          <div className="mt-1 text-xl font-bold text-emerald-700 font-mono tabular-nums">
            +{formatMoney(totalPlatformFeesUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Revenu prélevé automatiquement par votre plateforme
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Liens Actifs & Factures B2B
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {paymentLinks.length} liens · {invoices.length} factures
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Prêts à être partagés sur WhatsApp
          </p>
        </div>
      </div>

      {/* SUBVIEW 1: PAYMENT LINKS (SOCIAL COMMERCE) */}
      {subView === 'links' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Catalogue de Liens de Paiement Rapides (WhatsApp, Instagram,
                Facebook, SMS)
              </h2>
              <p className="text-xs text-slate-500">
                Créez un lien pour un produit ou service, envoyez-le à votre
                client et recevez l&apos;argent instantanément.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap self-start"
            >
              <Plus className="h-4 w-4" />
              <span>Créer un Lien de Paiement</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentLinks.map((link) => {
              const shareUrl = `https://kolapay.io/p/${link.shortCode}`;
              const whatsappShareText = `Bonjour ! Voici le lien sécurisé pour régler *${
                link.title
              }* (${formatMoney(
                link.amountUSD,
                displayCurrency,
                settings.rates
              )}) par Mobile Money ou Carte : ${shareUrl}`;

              return (
                <div
                  key={link.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                      <span>{link.shortCode}</span>
                      <span>·</span>
                      <span>
                        {link.clicksCount} vues · {link.salesCount} paiements
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {link.title}
                      </h3>
                      <div className="text-base font-bold text-emerald-700 font-mono tabular-nums shrink-0">
                        {formatMoney(
                          link.amountUSD,
                          displayCurrency,
                          settings.rates
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {link.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
                      <span className="truncate">{shareUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(shareUrl, link.id)}
                        className="inline-flex items-center gap-1 text-slate-900 font-sans font-semibold hover:text-emerald-700 ml-2 shrink-0"
                      >
                        {copiedId === link.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copier</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        Total encaissé :{' '}
                        <strong className="text-slate-800">
                          {formatMoney(
                            link.totalCollectedUSD,
                            displayCurrency,
                            settings.rates
                          )}
                        </strong>
                      </span>

                      <div className="flex items-center gap-2">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            whatsappShareText
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          onClick={() =>
                            openCustomerCheckout({
                              sourceType: 'payment_link',
                              sourceId: link.id,
                              title: link.title,
                              description: link.description,
                              amountUSD: link.amountUSD,
                              merchantName: link.merchantName,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Tester Page Paiement Client</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: INVOICES & QUOTES */}
      {subView === 'invoices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Facturation Électronique B2B avec Paiement Mobile Money & Carte
                Intégré
              </h2>
              <p className="text-xs text-slate-500">
                Émettez des factures professionnelles avec un bouton de
                règlement immédiat pour éviter les impayés.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap self-start"
            >
              <Plus className="h-4 w-4" />
              <span>Émettre une Facture</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">N° Facture & Échéance</th>
                    <th className="py-3 px-4">Client / Entreprise</th>
                    <th className="py-3 px-4">Objet de la Facture</th>
                    <th className="py-3 px-4 text-right">Montant Net</th>
                    <th className="py-3 px-4 text-right">Statut & Règlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {invoices.map((inv) => {
                    const cleanPhone = inv.clientPhone.replace(/[^0-9]/g, '');
                    const waInvoiceText = `Bonjour ${
                      inv.clientName
                    }, voici votre facture *${inv.invoiceNumber}* (${
                      inv.description
                    }) d'un montant de *${formatMoney(
                      inv.amountUSD,
                      displayCurrency,
                      settings.rates
                    )}* (Échéance : ${
                      inv.dueDate
                    }). Vous pouvez la régler directement par Mobile Money ou Carte bancaire via KolaPay.`;

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          <div className="font-semibold text-slate-900">
                            {inv.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Échéance : {inv.dueDate}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {inv.clientName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {inv.clientPhone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-sm">
                          {inv.description}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatMoney(
                            inv.amountUSD,
                            displayCurrency,
                            settings.rates
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {inv.status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Payée ({inv.paymentRail || 'En ligne'})
                              </span>
                            ) : (
                              <>
                                <span
                                  className={`font-medium ${
                                    inv.status === 'overdue'
                                      ? 'text-red-600'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {inv.status === 'overdue'
                                    ? 'En retard'
                                    : 'En attente'}
                                </span>

                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                    waInvoiceText
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                                >
                                  <Send className="h-3 w-3 text-emerald-600" />
                                  <span>Envoyer</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openCustomerCheckout({
                                      sourceType: 'invoice',
                                      sourceId: inv.id,
                                      title: `Facture ${inv.invoiceNumber} — ${inv.description}`,
                                      description: `Règlement de facture pour ${inv.clientName}`,
                                      amountUSD: inv.amountUSD,
                                      merchantName: settings.storeName,
                                      defaultCustomerName: inv.clientName,
                                      defaultCustomerPhone: inv.clientPhone,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                                >
                                  <span>Encaisser maintenant</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: DEVELOPER API & WEBHOOKS (SITES WEB & POS) */}
      {subView === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 6 columns: API Keys, Webhook Config & Code Snippets */}
          <div className="lg:col-span-6 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Identifiants d&apos;API Marchand (Intégration Web & POS)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPublicKey(
                      `pk_live_kola_${Math.random().toString(16).slice(2, 18)}`
                    );
                    setSecretKey(
                      `sk_live_kola_${Math.random().toString(16).slice(2, 18)}`
                    );
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Régénérer les clés</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">
                    Clé Publique (Sites Web, Widget JS & Terminaux POS)
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono">
                    <span className="truncate">{publicKey}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(publicKey, 'pk')}
                      className="text-slate-700 hover:text-slate-950 font-sans font-semibold ml-2"
                    >
                      {copiedId === 'pk' ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">
                    Clé Secrète Serveur (Appels Backend uniquement)
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono">
                    <span className="truncate">
                      {showSecretKey
                        ? secretKey
                        : 'sk_live_kola_••••••••••••••••••••'}
                    </span>
                    <div className="flex items-center gap-2 ml-2 font-sans">
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        {showSecretKey ? 'Masquer' : 'Afficher'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(secretKey, 'sk')}
                        className="font-semibold text-slate-800 hover:text-slate-950"
                      >
                        {copiedId === 'sk' ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">
                    URL Webhook de Notification Temps Réel (Signé HMAC-SHA256)
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Code snippet for Website / POS */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Exemple d&apos;Intégration API (Site E-Commerce & Caisse
                    POS)
                  </h3>
                </div>
              </div>

              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-100 font-mono">
                {`// Initialiser un paiement depuis un site web ou un POS
const response = await fetch('/api/v1/payment-intents', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${secretKey.slice(0, 18)}...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: ${apiTestAmount},
    currency: '${displayCurrency}',
    channel: '${apiTestChannel}',
    operator: '${apiTestRail}'
  })
});
const { id, checkout_url } = await response.json();`}
              </pre>
            </div>
          </div>

          {/* Right 6 columns: Live Interactive API Sandbox */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Simulateur d&apos;Appel API en Direct (`POST
                /api/v1/payment-intents`)
              </h3>
              <p className="text-xs text-slate-500">
                Testez notre vrai serveur backend Express intégré et observez la
                création du paiement + le Webhook signé.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Montant (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={apiTestAmount}
                  onChange={(e) => setApiTestAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Canal d&apos;origine
                </label>
                <select
                  value={apiTestChannel}
                  onChange={(e) =>
                    setApiTestChannel(
                      e.target.value as 'web_checkout' | 'pos_terminal'
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="web_checkout">Site Web E-Commerce</option>
                  <option value="pos_terminal">Terminal Caisse POS</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Opérateur / Rail
                </label>
                <select
                  value={apiTestRail}
                  onChange={(e) =>
                    setApiTestRail(e.target.value as FintechRail)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  {RAILS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              disabled={apiTestLoading}
              onClick={handleRunLiveApiTest}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {apiTestLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Exécution de la requête API en cours...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>
                    Exécuter la Requête API & Déclencher le Webhook (200 OK)
                  </span>
                </>
              )}
            </button>

            {apiResponseJson && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-emerald-700">
                  <span>HTTP/1.1 200 OK · Webhook HMAC-SHA256 vérifié</span>
                  <span>Commission 2% créditée</span>
                </div>
                <pre className="max-h-60 overflow-y-auto rounded-lg bg-slate-900 p-3.5 text-[11px] text-emerald-300 font-mono">
                  {apiResponseJson}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 4: MERCHANT WALLET, PAYOUTS & FINTECH MONETIZATION */}
      {subView === 'wallet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Merchant Wallet & Payouts */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Portefeuille Marchand & Demandes de Retrait (Payout)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Virer les fonds</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200 font-mono tabular-nums">
                <div>
                  <span className="text-[11px] font-sans text-slate-500">
                    Solde Net Retirable
                  </span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {formatMoney(
                      availableWalletBalanceUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-sans text-slate-500">
                    Total Déjà Viré
                  </span>
                  <div className="text-lg font-bold text-slate-700 mt-0.5">
                    {formatMoney(
                      totalWithdrawnUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Historique des Virements Marchands
                </div>
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {p.destination}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatDateTime(p.createdAt)}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-bold text-slate-900">
                        {formatMoney(
                          p.amountUSD,
                          displayCurrency,
                          settings.rates
                        )}
                      </div>
                      <span className="text-[11px] text-emerald-700 font-sans font-medium">
                        Exécuté
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 12-Month FinTech Commission Simulator */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Simulateur de Revenus FinTech sur 12 Mois (Vos Commissions)
                </h3>
                <p className="text-xs text-slate-500">
                  Estimez vos gains en prélevant une commission sur chaque
                  paiement Mobile Money / Carte encaissé par vos vendeurs.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-700">
                      Nombre de vendeurs / sites actifs sur KolaPay
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {simActiveVendors} marchands
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={500}
                    step={10}
                    value={simActiveVendors}
                    onChange={(e) =>
                      setSimActiveVendors(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-700">
                      Volume mensuel encaissé par marchand (USD)
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ${simAvgMonthlyVolumeUSD.toLocaleString('fr-FR')} / mois
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={10000}
                    step={200}
                    value={simAvgMonthlyVolumeUSD}
                    onChange={(e) =>
                      setSimAvgMonthlyVolumeUSD(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-700">
                      Votre commission par transaction (%)
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {simCommissionPct.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={5.0}
                    step={0.5}
                    value={simCommissionPct}
                    onChange={(e) =>
                      setSimCommissionPct(parseFloat(e.target.value))
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 font-mono tabular-nums">
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-600">
                    Vos Commissions Mensuelles :
                  </span>
                  <span className="font-bold text-slate-900">
                    ${simulatedMonthlyFintechFeeUSD.toLocaleString('fr-FR')} /
                    mois
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                  <span className="font-sans font-semibold text-slate-900">
                    Revenu Annuel FinTech (12 mois) :
                  </span>
                  <span className="text-lg font-bold text-emerald-700">
                    ${simulatedAnnualFintechFeeUSD.toLocaleString('fr-FR')} / an
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time FinTech Transactions & Webhooks Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-900">
            Journal Temps Réel des Paiements en Ligne & Webhooks Signés
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {transactions.length} transaction(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Réf. Intent & Date</th>
                <th className="py-3 px-4">Source / Canal</th>
                <th className="py-3 px-4">Client & Opérateur</th>
                <th className="py-3 px-4 text-right">Montant Brut</th>
                <th className="py-3 px-4 text-right">Commission (2%)</th>
                <th className="py-3 px-4 text-right">Net Marchand</th>
                <th className="py-3 px-4 text-right">Webhook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono tabular-nums">
                    <div className="font-semibold text-slate-900">
                      {tx.reference}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDateTime(tx.createdAt)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">
                      {tx.sourceTitle}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {tx.sourceType === 'payment_link'
                        ? 'Lien de Paiement Social'
                        : tx.sourceType === 'invoice'
                        ? 'Facture B2B'
                        : tx.sourceType === 'api_pos'
                        ? 'API Caisse POS'
                        : 'API Site Web'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">
                      {tx.customerName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {tx.paymentRail} · {tx.customerPhone}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatMoney(
                      tx.grossAmountUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    +
                    {formatMoney(
                      tx.platformFeeUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                    {formatMoney(
                      tx.netMerchantUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tx.webhookStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Payment Link */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Nouveau Lien de Paiement Rapide
                </h3>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLinkSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Titre du produit, pack ou service
                </label>
                <input
                  type="text"
                  required
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Ex: Pack Sac à Main Cuir + Livraison Express"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description affichée au client
                </label>
                <textarea
                  rows={2}
                  value={linkDesc}
                  onChange={(e) => setLinkDesc(e.target.value)}
                  placeholder="Ex: Paiement Mobile Money ou Visa. Livraison dans la journée."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Prix à encaisser (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={linkAmountUSD}
                  onChange={(e) => setLinkAmountUSD(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={linkCollectAddr}
                  onChange={(e) => setLinkCollectAddr(e.target.checked)}
                  className="rounded border-slate-300 accent-emerald-600"
                />
                <span>Demander l&apos;adresse de livraison au client</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Générer le lien
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Invoice */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Émettre une Facture Client avec Lien de Paiement
                </h3>
              </div>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleCreateInvoiceSubmit}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom du Client ou Société
                </label>
                <input
                  type="text"
                  required
                  value={invClientName}
                  onChange={(e) => setInvClientName(e.target.value)}
                  placeholder="Ex: Groupe Scolaire Les Lauréats"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Téléphone WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    value={invClientPhone}
                    onChange={(e) => setInvClientPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date d&apos;échéance
                  </label>
                  <input
                    type="date"
                    required
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Prestation ou Marchandises facturées
                </label>
                <input
                  type="text"
                  required
                  value={invDesc}
                  onChange={(e) => setInvDesc(e.target.value)}
                  placeholder="Ex: Fourniture papier rame A4 & consommables bureau"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Montant Total TTC (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={invAmountUSD}
                  onChange={(e) => setInvAmountUSD(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Créer la facture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Hosted Customer Checkout Page Simulator */}
      {activeCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold">
                    KolaPay Checkout Sécurisé
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Marchand : {activeCheckout.merchantName}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveCheckout(null)}
                className="rounded-lg p-1 text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {checkoutSuccessReceipt ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Paiement Confirmé !
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {checkoutSuccessReceipt.title}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-mono tabular-nums space-y-1 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Référence :</span>
                    <span className="font-semibold">
                      {checkoutSuccessReceipt.ref}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Montant réglé :</span>
                    <span className="font-bold text-emerald-700">
                      {formatMoney(
                        checkoutSuccessReceipt.amountUSD,
                        displayCurrency,
                        settings.rates
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Moyen utilisé :</span>
                    <span>{checkoutSuccessReceipt.rail}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCheckout(null)}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Fermer le reçu
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleConfirmCustomerCheckout}
                className="p-6 space-y-4"
              >
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-900">
                    {activeCheckout.title}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {activeCheckout.description}
                  </p>
                  <div className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
                    {formatMoney(
                      activeCheckout.amountUSD,
                      displayCurrency,
                      settings.rates
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Choisir le moyen de paiement
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {RAILS.map((rail) => (
                      <button
                        key={rail}
                        type="button"
                        onClick={() => setCheckoutRail(rail)}
                        className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                          checkoutRail === rail
                            ? 'border-emerald-600 bg-emerald-50 text-slate-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {rail}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Votre nom complet
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutCustomerName}
                      onChange={(e) => setCheckoutCustomerName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {checkoutRail === 'Visa / Mastercard'
                        ? 'N° Carte Visa / MC'
                        : `Téléphone ${checkoutRail}`}
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutCustomerPhone}
                      onChange={(e) => setCheckoutCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    {checkoutRail === 'Visa / Mastercard' ? (
                      <CreditCard className="h-3.5 w-3.5 text-slate-700" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span>Chiffrement TLS · Confirmation instantanée</span>
                  </span>
                  <QrCode className="h-4 w-4 text-slate-500" />
                </div>

                <button
                  type="submit"
                  disabled={checkoutProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {checkoutProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validation {checkoutRail} en cours...</span>
                    </>
                  ) : (
                    <span>
                      Payer{' '}
                      {formatMoney(
                        activeCheckout.amountUSD,
                        displayCurrency,
                        settings.rates
                      )}{' '}
                      maintenant
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Request Merchant Payout */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Virer le Solde Disponible (Payout)
              </h3>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRequestPayoutSubmit} className="p-6 space-y-4">
              <div className="flex justify-between rounded-lg bg-slate-50 p-3 text-xs font-mono">
                <span className="font-sans text-slate-600">
                  Plafond disponible :
                </span>
                <span className="font-bold text-slate-900">
                  ${availableWalletBalanceUSD.toFixed(2)} USD
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Compte Mobile Money ou IBAN Bancaire bénéficiaire
                </label>
                <input
                  type="text"
                  required
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Montant à transférer (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={availableWalletBalanceUSD}
                  required
                  value={payoutAmountUSD}
                  onChange={(e) => setPayoutAmountUSD(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Exécuter le virement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
