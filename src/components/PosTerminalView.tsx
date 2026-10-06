import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Barcode,
  Clock,
  HeartPulse,
  Minus,
  Plus,
  Scissors,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BusinessSector,
  CartItem,
  CurrencyCode,
  Customer,
  PharmacyCategory,
  Product,
  ProductCategory,
  SalonCategory,
  SalonTier,
  StoreSettings,
} from '../types';
import { formatMoney } from '../utils/format';

interface PosTerminalViewProps {
  products: Product[];
  customers: Customer[];
  cart: CartItem[];
  selectedCustomerId: string;
  globalDiscountPercent: number;
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  onAddToCart: (product: Product, options?: Partial<CartItem>) => void;
  onUpdateCartQty: (productId: string, newQty: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onSelectCustomer: (customerId: string) => void;
  onSetGlobalDiscount: (percent: number) => void;
  onQuickAddCustomer: (name: string, phone: string) => Customer;
  onOpenPaymentModal: () => void;
  // Specific hooks for Pharmacy & Salon
  prescriptionRef?: string;
  prescribingDoctor?: string;
  onChangePrescription?: (ref: string, doctor: string) => void;
  assignedStylist?: string;
  onChangeStylist?: (stylist: string) => void;
  tipAmountUSD?: number;
  onChangeTip?: (amount: number) => void;
}

const PHARMACY_CATEGORIES: PharmacyCategory[] = [
  'Antibiotiques & Anti-infectieux',
  'Antalgiques & Anti-inflammatoires',
  'Vitamines & Compléments DCI',
  'Dermatologie & Soins Plaies',
  'Matériel Médical & Injectables',
  'Pédiatrie & Sirop',
];

const SALON_CATEGORIES: SalonCategory[] = [
  'Coiffure & Coupe Homme/Femme',
  'Barbier & Soins Barbe VIP',
  'Tresses, Nattes & Extensions',
  'Coloration & Mèches Haute Couture',
  'Soins Kératine, Botox & Lissage',
  'Vente Produits Capillaires & Sérums',
];

type SectorFilter = 'all' | 'pharmacy' | 'salon_all' | 'salon_luxury' | 'salon_simple';

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  products,
  customers,
  cart,
  selectedCustomerId,
  globalDiscountPercent,
  displayCurrency,
  settings,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onClearCart,
  onSelectCustomer,
  onSetGlobalDiscount,
  onQuickAddCustomer,
  onOpenPaymentModal,
  prescriptionRef = '',
  prescribingDoctor = '',
  onChangePrescription,
  assignedStylist = '',
  onChangeStylist,
  tipAmountUSD = 0,
  onChangeTip,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [barcodeNotification, setBarcodeNotification] = useState<string | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('+243 ');

  // Internal state for prescription / stylist if not passed from parent
  const [localPrescription, setLocalPrescription] = useState(prescriptionRef);
  const [localDoctor, setLocalDoctor] = useState(prescribingDoctor);
  const [localStylist, setLocalStylist] = useState(assignedStylist || settings.availableStylists?.[0] || 'Jean-Marc (VIP)');
  const [localTip, setLocalTip] = useState(tipAmountUSD);

  const handleUpdatePrescription = (ref: string, doc: string) => {
    setLocalPrescription(ref);
    setLocalDoctor(doc);
    onChangePrescription?.(ref, doc);
  };

  const handleUpdateStylist = (sty: string) => {
    setLocalStylist(sty);
    onChangeStylist?.(sty);
  };

  const handleUpdateTip = (amount: number) => {
    setLocalTip(amount);
    onChangeTip?.(amount);
  };

  // Filter products based on sector and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Sector filter
      if (sectorFilter === 'pharmacy' && p.sector !== 'pharmacy') return false;
      if (sectorFilter === 'salon_all' && p.sector !== 'salon') return false;
      if (sectorFilter === 'salon_luxury') {
        if (p.sector !== 'salon' || p.salonTier !== 'Haut de Gamme') return false;
      }
      if (sectorFilter === 'salon_simple') {
        if (p.sector !== 'salon' || p.salonTier !== 'Simple') return false;
      }

      // Category filter
      if (activeCategory !== 'Tous' && p.category !== activeCategory) {
        return false;
      }

      // Search query
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const matchesBasic =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);

      const matchesPharma =
        (p.activeMolecule && p.activeMolecule.toLowerCase().includes(q)) ||
        (p.dosage && p.dosage.toLowerCase().includes(q)) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(q));

      const matchesSalon =
        (p.defaultStylist && p.defaultStylist.toLowerCase().includes(q)) ||
        (p.salonTier && p.salonTier.toLowerCase().includes(q));

      return matchesBasic || matchesPharma || matchesSalon;
    });
  }, [products, sectorFilter, activeCategory, searchQuery]);

  // Dynamic categories available according to active sector
  const availableCategories = useMemo(() => {
    if (sectorFilter === 'pharmacy') {
      return ['Tous', ...PHARMACY_CATEGORIES];
    }
    if (sectorFilter === 'salon_all' || sectorFilter === 'salon_luxury' || sectorFilter === 'salon_simple') {
      return ['Tous', ...SALON_CATEGORIES];
    }
    return ['Tous', ...PHARMACY_CATEGORIES, ...SALON_CATEGORIES];
  }, [sectorFilter]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const exactMatch = products.find(
        (p) =>
          p.barcode === searchQuery.trim() ||
          p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (exactMatch && exactMatch.stock > 0) {
        onAddToCart(exactMatch, {
          assignedStylist: exactMatch.sector === 'salon' ? localStylist : undefined,
          salonTier: exactMatch.salonTier,
        });
        setBarcodeNotification(
          `Scanné avec succès : ${exactMatch.name} (${exactMatch.barcode})`
        );
        setSearchQuery('');
        setTimeout(() => setBarcodeNotification(null), 3000);
      }
    }
  };

  const handleSimulateBarcodeScan = () => {
    const availableProducts = filteredProducts.filter((p) => p.stock > 0);
    const pool = availableProducts.length > 0 ? availableProducts : products.filter((p) => p.stock > 0);
    if (pool.length === 0) return;
    const randomProd = pool[Math.floor(Math.random() * pool.length)];
    onAddToCart(randomProd, {
      assignedStylist: randomProd.sector === 'salon' ? localStylist : undefined,
      salonTier: randomProd.salonTier,
    });
    setBarcodeNotification(
      `Scan Laser Douchette [${randomProd.barcode}] → ${randomProd.name}`
    );
    setTimeout(() => setBarcodeNotification(null), 3500);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    const created = onQuickAddCustomer(newCustName.trim(), newCustPhone.trim());
    onSelectCustomer(created.id);
    setNewCustName('');
    setNewCustPhone('+243 ');
    setShowNewCustomerForm(false);
  };

  // Inspect cart composition
  const hasPrescriptionMedication = cart.some(
    (item) => item.product.sector === 'pharmacy' && item.product.requiresPrescription
  );
  const hasSalonService = cart.some(
    (item) => item.product.sector === 'salon' && item.product.isService
  );

  // Cart calculations
  const rawSubtotalUSD = cart.reduce(
    (sum, item) => sum + item.product.salePriceUSD * item.quantity,
    0
  );
  const discountUSD =
    rawSubtotalUSD * (Math.min(100, Math.max(0, globalDiscountPercent)) / 100);
  const netSubtotalUSD = Math.max(0, rawSubtotalUSD - discountUSD);
  const taxUSD = netSubtotalUSD * (settings.taxRatePercent / 100);
  const totalUSD = netSubtotalUSD + taxUSD + (hasSalonService ? localTip : 0);

  const cartItemsCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  // Helper for expiry check
  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const exp = new Date(expiryDate).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'PÉRIMÉ', color: 'text-red-700 bg-red-100 border-red-300' };
    if (diffDays <= 90) return { label: `Exp. < 90j (${diffDays}j)`, color: 'text-amber-800 bg-amber-100 border-amber-300' };
    return { label: `Exp: ${expiryDate.slice(0, 7)}`, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 columns: Product Catalog & Scanner */}
      <div className="lg:col-span-8 space-y-4">
        {/* Sector Switcher Header specialized for Pharmacy and Hair Salon */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white uppercase tracking-wider">
                  CKaisse POS
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Caisse Spécialisée
                </span>
              </div>
              <h2 className="mt-1 text-sm font-semibold text-slate-900">
                Pharmacie / Dépôt Pharmaceutique & Salons de Coiffure (Haut de Gamme VIP & Simple)
              </h2>
            </div>

            {/* Quick Sector Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSectorFilter('all');
                  setActiveCategory('Tous');
                }}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  sectorFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous les rayons
              </button>

              <button
                type="button"
                onClick={() => {
                  setSectorFilter('pharmacy');
                  setActiveCategory('Tous');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  sectorFilter === 'pharmacy'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <HeartPulse className="h-3.5 w-3.5" />
                <span>Pharmacie & Dépôt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSectorFilter('salon_luxury');
                  setActiveCategory('Tous');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  sectorFilter === 'salon_luxury'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Salon Haut de Gamme VIP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSectorFilter('salon_simple');
                  setActiveCategory('Tous');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  sectorFilter === 'salon_simple'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Scissors className="h-3.5 w-3.5" />
                <span>Salon Simple & Barbier</span>
              </button>
            </div>
          </div>

          {/* Search bar & Scan trigger */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Rechercher médicament (DCI, Lot, Nom), soin ou prestation coiffure..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={handleSimulateBarcodeScan}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              title="Simuler la lecture d'un code-barres avec une douchette laser"
            >
              <Barcode className="h-4 w-4 text-emerald-600" />
              <span>Simuler Scan Douchette</span>
            </button>
          </div>
        </div>

        {barcodeNotification && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
            <span className="font-mono">{barcodeNotification}</span>
            <button
              onClick={() => setBarcodeNotification(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {availableCategories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Products & Services Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-medium text-slate-800">
              Aucun article ou prestation ne correspond à votre filtre.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Essayez un autre mot-clé, code SKU ou basculez de rayon (Pharmacie / Salon).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find(
                (item) => item.product.id === product.id
              );
              const qtyInCart = inCartItem ? inCartItem.quantity : 0;
              const remainingStock = product.stock - qtyInCart;
              const isOutOfStock = remainingStock <= 0;
              const isLowStock =
                remainingStock > 0 && remainingStock <= product.minStockAlert;
              const expiryBadge = getExpiryStatus(product.expiryDate);

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() =>
                    onAddToCart(product, {
                      assignedStylist:
                        product.sector === 'salon' ? localStylist : undefined,
                      salonTier: product.salonTier,
                    })
                  }
                  className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all relative ${
                    isOutOfStock
                      ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed'
                      : qtyInCart > 0
                      ? 'border-emerald-600 bg-white ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div>
                    {/* Sector specific header badges */}
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                      {product.sector === 'pharmacy' ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 font-mono">
                            <HeartPulse className="h-2.5 w-2.5" />
                            PHARMA
                          </span>
                          {product.requiresPrescription && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                              <Stethoscope className="h-2.5 w-2.5" />
                              Ordonnance
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {product.salonTier === 'Haut de Gamme' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                              <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                              VIP HAUT DE GAMME
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900">
                              <Scissors className="h-2.5 w-2.5 text-blue-600" />
                              SIMPLE & EXPRESS
                            </span>
                          )}
                          {product.durationMinutes && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                              <Clock className="h-2.5 w-2.5" />
                              {product.durationMinutes} min
                            </span>
                          )}
                        </div>
                      )}

                      <span className="text-[10px] font-mono text-slate-400">
                        {product.sku}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {product.name}
                    </h3>

                    {/* Sector specific details */}
                    {product.sector === 'pharmacy' && (
                      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                        {product.activeMolecule && (
                          <div className="font-mono text-slate-700 truncate">
                            DCI: <span className="font-medium text-slate-900">{product.activeMolecule}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          {product.batchNumber && (
                            <span className="font-mono text-slate-500">
                              Lot: {product.batchNumber}
                            </span>
                          )}
                          {expiryBadge && (
                            <span
                              className={`rounded border px-1.5 py-0.2 font-mono font-medium ${expiryBadge.color}`}
                            >
                              {expiryBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {product.sector === 'salon' && (
                      <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                        <div className="text-slate-500">
                          {product.isService ? 'Prestation coiffure en salon' : 'Produit cosmétique à emporter'}
                        </div>
                        {product.defaultStylist && (
                          <div className="text-[10px] font-medium text-slate-700 truncate">
                            Styliste : {product.defaultStylist.split('(')[0]}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                        {formatMoney(
                          product.salePriceUSD,
                          displayCurrency,
                          settings.rates
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] font-mono tabular-nums">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 font-medium text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            Rupture (0)
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Stock bas : {remainingStock} disp.
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {product.isService
                              ? 'Disponible immédiatement'
                              : `En stock : ${remainingStock} ${product.unit}s`}
                          </span>
                        )}
                      </div>
                    </div>

                    {qtyInCart > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white font-mono tabular-nums">
                        +{qtyInCart}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-600 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right 4 columns: Active POS Cart & Ticket Summary */}
      <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-xs">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Panier CKaisse
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              ({cartItemsCount} art.)
            </span>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Vider</span>
            </button>
          )}
        </div>

        {/* Customer Selector */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-600">
              Client / Patient associé
            </label>
            <button
              type="button"
              onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{showNewCustomerForm ? 'Fermer' : 'Nouveau client'}</span>
            </button>
          </div>

          {showNewCustomerForm ? (
            <form
              onSubmit={handleCreateCustomer}
              className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <input
                type="text"
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="Nom patient ou client du salon"
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="Téléphone WhatsApp (+243...)"
                  className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  Ajouter
                </button>
              </div>
            </form>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="">Client / Patient Comptoir (Vente directe)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                  {c.creditBalanceUSD > 0
                    ? ` (Dette/Crédit: $${c.creditBalanceUSD.toFixed(2)})`
                    : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Specialized Context Bar: Pharmacy Prescription fields */}
        {hasPrescriptionMedication && (
          <div className="border-b border-purple-200 bg-purple-50/70 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-purple-900">
              <Stethoscope className="h-3.5 w-3.5 text-purple-700" />
              <span>Ordonnance Médicale Obligatoire</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={localPrescription}
                onChange={(e) =>
                  handleUpdatePrescription(e.target.value, localDoctor)
                }
                placeholder="Réf: ORD-2026-XXXX"
                className="rounded border border-purple-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-900 focus:border-purple-600 focus:outline-none"
              />
              <input
                type="text"
                value={localDoctor}
                onChange={(e) =>
                  handleUpdatePrescription(localPrescription, e.target.value)
                }
                placeholder="Médecin / Clinique"
                className="rounded border border-purple-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-purple-600 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Specialized Context Bar: Salon Stylist & VIP Tip fields */}
        {hasSalonService && (
          <div className="border-b border-amber-200 bg-amber-50/60 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <Scissors className="h-3.5 w-3.5 text-amber-700" />
                <span>Coiffeur / Styliste assigné</span>
              </div>
              <span className="text-[10px] text-amber-700 font-mono">Commission</span>
            </div>
            <select
              value={localStylist}
              onChange={(e) => handleUpdateStylist(e.target.value)}
              className="w-full rounded border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-amber-600 focus:outline-none"
            >
              {settings.availableStylists?.map((sty) => (
                <option key={sty} value={sty}>
                  {sty}
                </option>
              ))}
            </select>

            {/* Stylist Tip selection */}
            <div className="pt-1 flex items-center justify-between text-[11px]">
              <span className="text-amber-900 font-medium">Pourboire Styliste VIP:</span>
              <div className="flex items-center gap-1">
                {[0, 2, 5, 10].map((tip) => (
                  <button
                    key={tip}
                    type="button"
                    onClick={() => handleUpdateTip(tip)}
                    className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      localTip === tip
                        ? 'bg-amber-700 text-white font-bold'
                        : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {tip === 0 ? '0$' : `+$${tip}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cart Items List */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 px-5">
          {cart.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-medium text-slate-500">
                Le panier CKaisse est vide.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Sélectionnez un médicament ou une prestation coiffure à gauche pour débuter l'encaissement.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const lineTotalUSD = item.product.salePriceUSD * item.quantity;
              return (
                <div
                  key={item.product.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {item.product.name}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>
                        {formatMoney(
                          item.product.salePriceUSD,
                          displayCurrency,
                          settings.rates
                        )}{' '}
                        / {item.product.unit}
                      </span>
                      {item.product.dosage && (
                        <span>· {item.product.dosage}</span>
                      )}
                      {item.salonTier && (
                        <span className="text-amber-800 font-sans font-medium">
                          · {item.salonTier}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCartQty(item.product.id, item.quantity - 1)
                      }
                      className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-100"
                      aria-label="Diminuer la quantité"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold font-mono tabular-nums text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={item.quantity >= item.product.stock}
                      onClick={() =>
                        onUpdateCartQty(item.product.id, item.quantity + 1)
                      }
                      className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      aria-label="Augmenter la quantité"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Line total & delete */}
                  <div className="text-right shrink-0 min-w-[80px]">
                    <div className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                      {formatMoney(
                        lineTotalUSD,
                        displayCurrency,
                        settings.rates
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(item.product.id)}
                      className="text-[11px] text-slate-400 hover:text-red-600"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Checkout CTA */}
        <div className="border-t border-slate-200 bg-slate-50 p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Remise commerciale (%)</span>
            <div className="flex items-center gap-1.5">
              {[0, 5, 10].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onSetGlobalDiscount(pct)}
                  className={`rounded px-2 py-0.5 text-[11px] font-mono tabular-nums transition-colors ${
                    globalDiscountPercent === pct
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-xs border-t border-slate-200 pt-3 font-mono tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Sous-total HT</span>
              <span>
                {formatMoney(rawSubtotalUSD, displayCurrency, settings.rates)}
              </span>
            </div>

            {discountUSD > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span className="font-sans">
                  Remise ({globalDiscountPercent}%)
                </span>
                <span>
                  -{formatMoney(discountUSD, displayCurrency, settings.rates)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span className="font-sans">
                TVA ({settings.taxRatePercent}%)
              </span>
              <span>{formatMoney(taxUSD, displayCurrency, settings.rates)}</span>
            </div>

            {hasSalonService && localTip > 0 && (
              <div className="flex justify-between text-amber-800">
                <span className="font-sans">
                  Pourboire Styliste VIP
                </span>
                <span>+{formatMoney(localTip, displayCurrency, settings.rates)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
              <span className="font-sans text-sm">Net à payer</span>
              <span>
                {formatMoney(totalUSD, displayCurrency, settings.rates)}
              </span>
            </div>

            {displayCurrency !== 'CDF' && (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span className="font-sans">Contre-valeur CDF</span>
                <span>{formatMoney(totalUSD, 'CDF', settings.rates)}</span>
              </div>
            )}
            {displayCurrency !== 'USD' && (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span className="font-sans">Contre-valeur USD</span>
                <span>{formatMoney(totalUSD, 'USD', settings.rates)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onOpenPaymentModal}
            className="w-full rounded-lg bg-emerald-600 py-3 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-xs"
          >
            Encaisser{' '}
            {cart.length > 0
              ? `(${formatMoney(totalUSD, displayCurrency, settings.rates)})`
              : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
