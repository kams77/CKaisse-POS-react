import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  HeartPulse,
  KeyRound,
  Lock,
  Plus,
  Save,
  Scissors,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { BusinessSector, SaaSTenant, StoreSettings } from '../types';

interface SaaSBusinessViewProps {
  tenants: SaaSTenant[];
  settings: StoreSettings;
  onAddTenant: (
    tenant: Omit<SaaSTenant, 'id' | 'joinedAt' | 'licenseKey'>
  ) => void;
  onUpdateTenantStatus: (
    tenantId: string,
    status: SaaSTenant['billingStatus']
  ) => void;
  onUpdateSettings: (newSettings: StoreSettings) => void;
}

export const SaaSBusinessView: React.FC<SaaSBusinessViewProps> = ({
  tenants,
  settings,
  onAddTenant,
  onUpdateTenantStatus,
  onUpdateSettings,
}) => {
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('+243 ');
  const [city, setCity] = useState('Kinshasa');
  const [businessType, setBusinessType] =
    useState<SaaSTenant['businessType']>('Pharmacie & Dépôt Pharmaceutique');
  const [plan, setPlan] = useState<SaaSTenant['plan']>('Business');
  const [terminalsCount, setTerminalsCount] = useState('2');

  // Revenue Simulator state
  const [simStarterCount, setSimStarterCount] = useState(25);
  const [simBusinessCount, setSimBusinessCount] = useState(20);
  const [simEnterpriseCount, setSimEnterpriseCount] = useState(8);

  // Settings form state
  const [formSettings, setFormSettings] = useState<StoreSettings>(settings);
  const [savedBanner, setSavedBanner] = useState(false);
  const [newStylistName, setNewStylistName] = useState('');

  // Actual SaaS metrics from tenants list
  const activeTenants = tenants.filter((t) => t.billingStatus === 'Actif');
  const currentMRR = activeTenants.reduce(
    (sum, t) => sum + t.monthlyFeeUSD,
    0
  );
  const totalPotentialMRR = tenants.reduce(
    (sum, t) => sum + t.monthlyFeeUSD,
    0
  );

  // Simulator calculations
  const simulatedMonthlyUSD =
    simStarterCount * 19 + simBusinessCount * 39 + simEnterpriseCount * 79;
  const simulatedAnnualUSD = simulatedMonthlyUSD * 12;
  const totalSimStores =
    simStarterCount + simBusinessCount + simEnterpriseCount;

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !ownerName.trim()) return;
    const fee = plan === 'Starter' ? 19 : plan === 'Business' ? 39 : 79;
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);

    onAddTenant({
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      businessType,
      plan,
      monthlyFeeUSD: fee,
      billingStatus: 'Actif',
      terminalsCount: Math.max(1, parseInt(terminalsCount, 10) || 1),
      nextBillingDate: nextDate.toISOString().slice(0, 10),
    });

    setStoreName('');
    setOwnerName('');
    setPhone('+243 ');
    setIsAddTenantOpen(false);
  };

  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formSettings);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleAddStylist = () => {
    if (!newStylistName.trim()) return;
    const current = formSettings.availableStylists || [];
    if (!current.includes(newStylistName.trim())) {
      setFormSettings({
        ...formSettings,
        availableStylists: [...current, newStylistName.trim()],
      });
    }
    setNewStylistName('');
  };

  const handleRemoveStylist = (stylistToRemove: string) => {
    const current = formSettings.availableStylists || [];
    setFormSettings({
      ...formSettings,
      availableStylists: current.filter((s) => s !== stylistToRemove),
    });
  };

  return (
    <div className="space-y-8">
      {/* Section 1: SaaS Owner Subscription Management */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                CKaisse POS
              </span>
              <h2 className="text-base font-bold text-slate-900">
                01. Administration SaaS & Abonnements Métiers
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Gestion des établissements abonnés : Pharmacies, Dépôts Pharmaceutiques et Salons de Coiffure (VIP & Simple).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddTenantOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap self-start shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Inscrire un Nouvel Établissement</span>
          </button>
        </div>

        {/* SaaS KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-medium text-slate-500">
              Revenu Mensuel Récurrent (MRR Actif)
            </span>
            <div className="mt-1 text-xl font-bold text-emerald-700 font-mono tabular-nums">
              ${currentMRR.toFixed(2)} / mois
            </div>
            <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              Potentiel total : ${totalPotentialMRR.toFixed(2)} / mois
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-medium text-slate-500">
              Revenu Annuel Projeté (ARR)
            </span>
            <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
              ${(currentMRR * 12).toFixed(2)} / an
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Basé sur les contrats actifs en cours
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-medium text-slate-500">
              Établissements Clients Déployés
            </span>
            <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
              {activeTenants.length} actifs
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {tenants.length} établissements sous contrat
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-medium text-slate-500">
              Tarifs Abonnements CKaisse POS
            </span>
            <div className="mt-1 text-sm font-semibold text-slate-900 font-mono">
              19$ · 39$ · 79$
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Starter, Business & Enterprise
            </p>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Portefeuille des Pharmacies & Salons Abonnés
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {tenants.length} licences déployées
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Établissement & Gérant</th>
                  <th className="py-3 px-4">Secteur Spécialisé</th>
                  <th className="py-3 px-4">Ville</th>
                  <th className="py-3 px-4">Forfait</th>
                  <th className="py-3 px-4">Clé de Licence</th>
                  <th className="py-3 px-4">État Facturation</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {tenant.storeName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {tenant.ownerName} · {tenant.phone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {tenant.businessType.includes('Pharmacie') ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          <HeartPulse className="h-3 w-3" />
                          {tenant.businessType}
                        </span>
                      ) : tenant.businessType.includes('Haut de Gamme') ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          <Sparkles className="h-3 w-3 text-amber-600" />
                          {tenant.businessType}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-900">
                          <Scissors className="h-3 w-3 text-blue-600" />
                          {tenant.businessType}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {tenant.city}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-semibold text-slate-900">
                        {tenant.plan}
                      </span>{' '}
                      <span className="text-slate-500">
                        (${tenant.monthlyFeeUSD}/m)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      <div className="flex items-center gap-1">
                        <KeyRound className="h-3 w-3 text-slate-400" />
                        <span>{tenant.licenseKey}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                          tenant.billingStatus === 'Actif'
                            ? 'bg-emerald-50 text-emerald-700'
                            : tenant.billingStatus === 'Essai gratuit'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {tenant.billingStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <select
                        aria-label={`Statut de facturation pour ${tenant.storeName}`}
                        value={tenant.billingStatus}
                        onChange={(e) =>
                          onUpdateTenantStatus(
                            tenant.id,
                            e.target.value as SaaSTenant['billingStatus']
                          )
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-slate-900 focus:outline-none"
                      >
                        <option value="Actif">Actif</option>
                        <option value="Essai gratuit">Essai gratuit</option>
                        <option value="Retard de paiement">
                          Retard de paiement
                        </option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 2: Financial Projection Simulator */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <Calculator className="h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              02. Simulateur de Rentabilité SaaS sur 12 Mois
            </h2>
            <p className="text-xs text-slate-500">
              Projetez vos revenus d'abonnements mensuels et annuels en déployant CKaisse POS dans les officines et salons.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sliders */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-700">
                  Salons Simples / Petites Officines — Starter (19 $/mois)
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {simStarterCount} clients
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simStarterCount}
                onChange={(e) => setSimStarterCount(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-700">
                  Pharmacies & Salons Prestige — Business (39 $/mois)
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {simBusinessCount} clients
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simBusinessCount}
                onChange={(e) => setSimBusinessCount(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-700">
                  Grands Dépôts Pharmaceutiques & Spas VIP — Enterprise (79 $/mois)
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {simEnterpriseCount} clients
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={simEnterpriseCount}
                onChange={(e) => setSimEnterpriseCount(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>

          {/* Results card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-950 uppercase tracking-wider">
                Projection Réseau ({totalSimStores} établissements)
              </span>
              <div className="mt-3">
                <span className="text-xs text-slate-600">Revenu Mensuel Récurrent</span>
                <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                  ${simulatedMonthlyUSD.toLocaleString('en-US')} / mois
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-emerald-200">
                <span className="text-xs text-slate-600">Revenu Annuel Net (ARR)</span>
                <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                  ${simulatedAnnualUSD.toLocaleString('en-US')} / an
                </div>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-slate-500">
              * Encaissements récurrents en direct via Mobile Money ou Carte Bancaire.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Store Configuration Parameters */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                03. Paramètres Métier de l'Établissement Actif
              </h2>
              <p className="text-xs text-slate-500">
                Personnalisez les coordonnées, agrément officiel officine, liste des stylistes et mot de passe administrateur.
              </p>
            </div>
          </div>
          {savedBanner && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Modifications enregistrées !
            </span>
          )}
        </div>

        <form onSubmit={handleSaveStoreSettings} className="space-y-4">
          {/* Active Sector selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Secteur d'activité actif de cette caisse
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label
                className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer ${
                  formSettings.sector === 'pharmacy'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="storeSector"
                  checked={formSettings.sector === 'pharmacy'}
                  onChange={() =>
                    setFormSettings({ ...formSettings, sector: 'pharmacy' })
                  }
                  className="sr-only"
                />
                <HeartPulse className="h-4 w-4 text-emerald-600" />
                <div>
                  <div>Pharmacie & Dépôt Pharmaceutique</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Ordonnances, DCI, Lots, Suivi des péremptions
                  </div>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer ${
                  formSettings.sector === 'salon'
                    ? 'border-amber-600 bg-amber-50 text-amber-950 font-semibold ring-1 ring-amber-600'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="storeSector"
                  checked={formSettings.sector === 'salon'}
                  onChange={() =>
                    setFormSettings({ ...formSettings, sector: 'salon' })
                  }
                  className="sr-only"
                />
                <Scissors className="h-4 w-4 text-amber-600" />
                <div>
                  <div>Salon de Coiffure & Institut de Beauté</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Prestations VIP, Salons simples, Pourboires stylistes
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Raison sociale / Nom commercial
              </label>
              <input
                type="text"
                value={formSettings.storeName}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, storeName: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adresse physique officielle
              </label>
              <input
                type="text"
                value={formSettings.address}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, address: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Téléphone de contact / WhatsApp
              </label>
              <input
                type="tel"
                value={formSettings.phone}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, phone: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Numéro RCCM / Identifiant Fiscal
              </label>
              <input
                type="text"
                value={formSettings.taxId}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, taxId: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                N° d'Agrément Ordre des Pharmaciens (Pharmacies)
              </label>
              <input
                type="text"
                value={formSettings.pharmacyLicenseNumber || ''}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    pharmacyLicenseNumber: e.target.value,
                  })
                }
                placeholder="Ex: ORD-PHARMA-CD-2026/894-KIN"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Taux TVA légale (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formSettings.taxRatePercent}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    taxRatePercent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Caissier / Réceptionniste en service
              </label>
              <input
                type="text"
                value={formSettings.cashierName}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    cashierName: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Taux de change (1 USD en Franc Congolais CDF)
              </label>
              <input
                type="number"
                value={formSettings.rates.CDF}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    rates: {
                      ...formSettings.rates,
                      CDF: parseFloat(e.target.value) || 2850,
                    },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mot de Passe Administrateur (Codes-Barres)
              </label>
              <input
                type="text"
                value={formSettings.adminPassword || 'ADMIN2026'}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    adminPassword: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 font-semibold"
              />
            </div>
          </div>

          {/* Stylists list management for Salons */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Scissors className="h-4 w-4 text-amber-600" />
                <span>Équipe de Stylistes, Coiffeurs & Barbiers du Salon</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {formSettings.availableStylists?.length || 0} référencés
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {formSettings.availableStylists?.map((stylist) => (
                <span
                  key={stylist}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-800 shadow-2xs"
                >
                  <span>{stylist}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStylist(stylist)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md pt-1">
              <input
                type="text"
                value={newStylistName}
                onChange={(e) => setNewStylistName(e.target.value)}
                placeholder="Ex: David (Coiffeur Senior Visagiste)"
                className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddStylist}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                Ajouter Styliste
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Message imprimé en pied de ticket de caisse
            </label>
            <input
              type="text"
              value={formSettings.receiptFooter}
              onChange={(e) =>
                setFormSettings({
                  ...formSettings,
                  receiptFooter: e.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>Enregistrer Tous les Paramètres</span>
            </button>
          </div>
        </form>
      </div>

      {/* MODAL: Add Tenant */}
      {isAddTenantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Inscrire un Établissement Client (SaaS)
                </h3>
              </div>
              <button
                onClick={() => setIsAddTenantOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom de l'Établissement *
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Pharmacie du Progrès, Salon Prestige VIP..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Responsable / Titulaire *
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ex: Dr. Kabila, Patrick M."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Téléphone WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Secteur d'activité
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) =>
                      setBusinessType(
                        e.target.value as SaaSTenant['businessType']
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-medium"
                  >
                    <option value="Pharmacie & Dépôt Pharmaceutique">
                      Pharmacie & Dépôt Pharmaceutique
                    </option>
                    <option value="Salon de Coiffure Haut de Gamme">
                      Salon de Coiffure Haut de Gamme
                    </option>
                    <option value="Salon de Coiffure & Barbier Simple">
                      Salon de Coiffure & Barbier Simple
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Forfait choisi
                  </label>
                  <select
                    value={plan}
                    onChange={(e) =>
                      setPlan(e.target.value as SaaSTenant['plan'])
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-semibold"
                  >
                    <option value="Starter">Starter (19 $ / mois)</option>
                    <option value="Business">Business (39 $ / mois)</option>
                    <option value="Enterprise">Enterprise (79 $ / mois)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre de terminaux
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={terminalsCount}
                    onChange={(e) => setTerminalsCount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTenantOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                >
                  Générer Clé CKAISSE & Activer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
