import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { CurrencyCode, Customer, StoreSettings } from '../types';
import { convertToUSD, formatDateTime, formatMoney } from '../utils/format';

interface CustomersViewProps {
  customers: Customer[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'lastVisit'>) => void;
  onRecordDebtPayment: (customerId: string, amountPaidUSD: number) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  displayCurrency,
  settings,
  onAddCustomer,
  onRecordDebtPayment,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'debt'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add customer state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+243 ');
  const [email, setEmail] = useState('');
  const [initialCreditUSD, setInitialCreditUSD] = useState('0');
  const [notes, setNotes] = useState('');

  // Repay modal state
  const [repayCustomer, setRepayCustomer] = useState<Customer | null>(null);
  const [repayAmountDisplay, setRepayAmountDisplay] = useState('');

  const totalDebtUSD = customers.reduce(
    (sum, c) => sum + c.creditBalanceUSD,
    0
  );
  const debtorsCount = customers.filter((c) => c.creditBalanceUSD > 0).length;

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterMode === 'debt' && c.creditBalanceUSD <= 0) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });
  }, [customers, filterMode, search]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      totalPurchasesUSD: 0,
      creditBalanceUSD: Math.max(0, parseFloat(initialCreditUSD) || 0),
      notes: notes.trim() || undefined,
    });
    setName('');
    setPhone('+243 ');
    setEmail('');
    setInitialCreditUSD('0');
    setNotes('');
    setIsAddOpen(false);
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayCustomer) return;
    const val = parseFloat(repayAmountDisplay) || 0;
    if (val <= 0) return;
    const paidUSD = convertToUSD(val, displayCurrency, settings.rates);
    onRecordDebtPayment(repayCustomer.id, paidUSD);
    setRepayCustomer(null);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Fichier Clients Enregistrés
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {customers.length} client(s)
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Suivi fidélité & historique d&apos;achats
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Total Crédits Clients à Recouvrer
          </span>
          <div className="mt-1 text-xl font-bold text-amber-700 font-mono tabular-nums">
            {formatMoney(totalDebtUSD, displayCurrency, settings.rates)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Répartis sur {debtorsCount} compte(s) débiteur(s)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs font-medium text-slate-500">
            Volume d&apos;Achats Cumulé (Clients Fidèles)
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatMoney(
              customers.reduce((acc, c) => acc + c.totalPurchasesUSD, 0),
              displayCurrency,
              settings.rates
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Valeur vie client enregistrée
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client par nom ou téléphone..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous les clients ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('debt')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === 'debt'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Crédits à recouvrer ({debtorsCount})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Client & Contact</th>
                <th className="py-3 px-4">Notes commerciales</th>
                <th className="py-3 px-4">Dernière visite</th>
                <th className="py-3 px-4 text-right">Achats Cumulés</th>
                <th className="py-3 px-4 text-right">Solde Crédit (Dette)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredCustomers.map((customer) => {
                const hasDebt = customer.creditBalanceUSD > 0.01;
                const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
                const reminderText = `Bonjour ${
                  customer.name
                }, sauf erreur de notre part, votre solde crédit chez *${
                  settings.storeName
                }* s'élève à *${formatMoney(
                  customer.creditBalanceUSD,
                  displayCurrency,
                  settings.rates
                )}*. Vous pouvez régler par Mobile Money ou en caisse. Merci !`;
                const waReminderUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                  reminderText
                )}`;

                return (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {customer.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {customer.phone}
                        {customer.email ? ` · ${customer.email}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">
                      {customer.notes || 'Client régulier'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {formatDateTime(customer.lastVisit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatMoney(
                        customer.totalPurchasesUSD,
                        displayCurrency,
                        settings.rates
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {hasDebt ? (
                        <span className="inline-flex items-center justify-end gap-1 font-bold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {formatMoney(
                            customer.creditBalanceUSD,
                            displayCurrency,
                            settings.rates
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />À jour (0)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {hasDebt && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRepayCustomer(customer);
                                const amt =
                                  customer.creditBalanceUSD *
                                  (settings.rates[displayCurrency] || 1);
                                setRepayAmountDisplay(
                                  displayCurrency === 'CDF' ||
                                    displayCurrency === 'XOF'
                                    ? Math.round(amt).toString()
                                    : amt.toFixed(2)
                                );
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              <span>Encaisser dette</span>
                            </button>

                            <a
                              href={waReminderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                              title="Envoyer un rappel de paiement sur WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Relance WhatsApp</span>
                            </a>
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

      {/* Add Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Nouveau Compte Client
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom complet ou Entreprise
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Hôtel Résidence du Fleuve"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Téléphone WhatsApp / Mobile Money
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Solde crédit initial (USD) si dette antérieure
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={initialCreditUSD}
                  onChange={(e) => setInitialCreditUSD(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes commerciales
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Grossiste, plafond crédit 200$"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Créer le client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Debt Modal */}
      {repayCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Règlement de Crédit Client
                </h3>
                <p className="text-xs text-slate-500">{repayCustomer.name}</p>
              </div>
              <button
                onClick={() => setRepayCustomer(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRepaySubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs">
                <span className="text-amber-900">Dette totale actuelle :</span>
                <span className="font-mono font-bold text-amber-900">
                  {formatMoney(
                    repayCustomer.creditBalanceUSD,
                    displayCurrency,
                    settings.rates
                  )}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Montant remboursé aujourd&apos;hui ({displayCurrency})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={repayAmountDisplay}
                  onChange={(e) => setRepayAmountDisplay(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepayCustomer(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Valider le remboursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
