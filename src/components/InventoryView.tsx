import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  Barcode,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  HeartPulse,
  Lock,
  PackagePlus,
  Plus,
  Printer,
  Scissors,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import {
  BarcodeBatchRecord,
  BusinessSector,
  CurrencyCode,
  PharmacyCategory,
  Product,
  ProductCategory,
  SalonCategory,
  SalonTier,
  StockMovement,
  StoreSettings,
} from '../types';
import { formatDateTime, formatMoney } from '../utils/format';

interface InventoryViewProps {
  products: Product[];
  stockMovements: StockMovement[];
  barcodeBatches: BarcodeBatchRecord[];
  displayCurrency: CurrencyCode;
  settings: StoreSettings;
  onSaveProduct: (
    productData: Omit<Product, 'id' | 'updatedAt' | 'sku'>,
    existingId?: string
  ) => Product;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (
    productId: string,
    quantityDelta: number,
    type: 'in' | 'adjustment',
    note: string
  ) => void;
  onGenerateBarcodeBatch: (batchData: {
    startBarcode: string;
    quantity: number;
    label: string;
    authorizedBy: string;
  }) => BarcodeBatchRecord;
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

export function buildAutoSkuPreview(
  category: ProductCategory,
  totalProductsCount: number,
  sector: BusinessSector = 'pharmacy',
  salonTier?: SalonTier
): string {
  const nextNumber = (totalProductsCount + 1).toString().padStart(4, '0');
  if (sector === 'pharmacy') {
    return `ART-PHARM-${nextNumber}`;
  }
  if (salonTier === 'Haut de Gamme') {
    return `ART-SALON-VIP-${nextNumber}`;
  }
  return `ART-SALON-SIMP-${nextNumber}`;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  stockMovements,
  barcodeBatches,
  displayCurrency,
  settings,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  onGenerateBarcodeBatch,
}) => {
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<
    'all' | 'pharmacy' | 'salon_all' | 'salon_luxury' | 'salon_simple'
  >('all');
  const [stockFilter, setStockFilter] = useState<
    'all' | 'low' | 'out' | 'healthy' | 'prescription' | 'expiring_soon'
  >('all');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [skuAssignedBanner, setSkuAssignedBanner] = useState<string | null>(null);

  // Restock modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockDelta, setRestockDelta] = useState<string>('10');
  const [restockType, setRestockType] = useState<'in' | 'adjustment'>('in');
  const [restockNote, setRestockNote] = useState<string>(
    'Livraison fournisseur / Laboratoire'
  );

  // Barcode Batch Generation Modal (Admin Protected)
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [batchStartCode, setBatchStartCode] = useState('6181100050011');
  const [batchQuantity, setBatchQuantity] = useState('20');
  const [batchLabel, setBatchLabel] = useState(
    'Lot étiquettes codes-barres officine / salon'
  );
  const [batchAdminName, setBatchAdminName] = useState(
    'Pharmacien Titulaire / Direction Salon'
  );
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [inspectedBatch, setInspectedBatch] =
    useState<BarcodeBatchRecord | null>(null);

  // Product form state
  const [formSector, setFormSector] = useState<BusinessSector>('pharmacy');
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>(
    'Antibiotiques & Anti-infectieux'
  );
  const [formCostUSD, setFormCostUSD] = useState('2.50');
  const [formSaleUSD, setFormSaleUSD] = useState('5.00');
  const [formStock, setFormStock] = useState('20');
  const [formMinAlert, setFormMinAlert] = useState('5');
  const [formUnit, setFormUnit] = useState('Boîte');
  const [formSupplier, setFormSupplier] = useState('');

  // Pharmacy specific form fields
  const [formActiveMolecule, setFormActiveMolecule] = useState('');
  const [formDosage, setFormDosage] = useState('');
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('2028-12-31');
  const [formRequiresPrescription, setFormRequiresPrescription] =
    useState(false);

  // Salon specific form fields
  const [formIsService, setFormIsService] = useState(true);
  const [formSalonTier, setFormSalonTier] = useState<SalonTier>('Simple');
  const [formDurationMinutes, setFormDurationMinutes] = useState('30');
  const [formDefaultStylist, setFormDefaultStylist] = useState(
    settings.availableStylists?.[0] || 'Jean-Marc (VIP)'
  );

  // Available unused barcodes from generated batches
  const usedBarcodesSet = useMemo(
    () => new Set(products.map((p) => p.barcode)),
    [products]
  );

  const availableGeneratedBarcodes = useMemo(() => {
    const list: Array<{ code: string; batchCode: string; label: string }> = [];
    for (const batch of barcodeBatches) {
      for (const code of batch.codes) {
        if (!usedBarcodesSet.has(code)) {
          list.push({
            code,
            batchCode: batch.batchCode,
            label: batch.label,
          });
        }
      }
    }
    return list;
  }, [barcodeBatches, usedBarcodesSet]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormSector(settings.sector || 'pharmacy');
    setFormName('');
    const nextFreeBarcode =
      availableGeneratedBarcodes.length > 0
        ? availableGeneratedBarcodes[0].code
        : `61811000${Math.floor(70000 + Math.random() * 20000)}`;
    setFormBarcode(nextFreeBarcode);
    setFormCategory('Antibiotiques & Anti-infectieux');
    setFormCostUSD('2.50');
    setFormSaleUSD('5.00');
    setFormStock('25');
    setFormMinAlert('5');
    setFormUnit('Boîte');
    setFormSupplier('Laboratoire Pharma');
    setFormActiveMolecule('');
    setFormDosage('500 mg');
    setFormBatchNumber(`LOT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 89)}`);
    setFormExpiryDate('2028-12-31');
    setFormRequiresPrescription(false);
    setFormIsService(true);
    setFormSalonTier('Simple');
    setFormDurationMinutes('30');
    setFormDefaultStylist(settings.availableStylists?.[0] || 'Jean-Marc (VIP)');
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormSector(product.sector);
    setFormName(product.name);
    setFormBarcode(product.barcode);
    setFormCategory(product.category);
    setFormCostUSD(product.costPriceUSD.toString());
    setFormSaleUSD(product.salePriceUSD.toString());
    setFormStock(product.stock.toString());
    setFormMinAlert(product.minStockAlert.toString());
    setFormUnit(product.unit);
    setFormSupplier(product.supplier);
    setFormActiveMolecule(product.activeMolecule || '');
    setFormDosage(product.dosage || '');
    setFormBatchNumber(product.batchNumber || '');
    setFormExpiryDate(product.expiryDate || '2028-12-31');
    setFormRequiresPrescription(Boolean(product.requiresPrescription));
    setFormIsService(Boolean(product.isService));
    setFormSalonTier(product.salonTier || 'Simple');
    setFormDurationMinutes((product.durationMinutes || 30).toString());
    setFormDefaultStylist(product.defaultStylist || settings.availableStylists?.[0] || '');
    setIsProductModalOpen(true);
  };

  const handleProductFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const saved = onSaveProduct(
      {
        name: formName.trim(),
        barcode: formBarcode.trim() || '6181100000000',
        category: formCategory,
        sector: formSector,
        costPriceUSD: Math.max(0, parseFloat(formCostUSD) || 0),
        salePriceUSD: Math.max(0.01, parseFloat(formSaleUSD) || 0),
        stock: Math.max(0, parseInt(formStock, 10) || 0),
        minStockAlert: Math.max(0, parseInt(formMinAlert, 10) || 0),
        unit: formUnit.trim() || 'Pièce',
        supplier: formSupplier.trim() || 'Standard',
        // Pharma
        activeMolecule: formSector === 'pharmacy' ? formActiveMolecule.trim() || undefined : undefined,
        dosage: formSector === 'pharmacy' ? formDosage.trim() || undefined : undefined,
        batchNumber: formSector === 'pharmacy' ? formBatchNumber.trim() || undefined : undefined,
        expiryDate: formSector === 'pharmacy' ? formExpiryDate.trim() || undefined : undefined,
        requiresPrescription: formSector === 'pharmacy' ? formRequiresPrescription : undefined,
        // Salon
        isService: formSector === 'salon' ? formIsService : undefined,
        salonTier: formSector === 'salon' ? formSalonTier : undefined,
        durationMinutes: formSector === 'salon' ? parseInt(formDurationMinutes, 10) || 30 : undefined,
        defaultStylist: formSector === 'salon' ? formDefaultStylist.trim() || undefined : undefined,
      },
      editingProduct?.id
    );

    setIsProductModalOpen(false);
    setSkuAssignedBanner(
      `Enregistré avec succès ! Code interne attribué : ${saved.sku} (Rayon : ${
        saved.sector === 'pharmacy' ? 'Pharmacie & Dépôt' : `Salon ${saved.salonTier || ''}`
      })`
    );
    setTimeout(() => setSkuAssignedBanner(null), 5000);
  };

  const openBarcodeGeneratorModal = () => {
    let maxNum = 6181100050010;
    for (const b of barcodeBatches) {
      const endNum = parseInt(b.endBarcode, 10);
      if (!isNaN(endNum) && endNum > maxNum) {
        maxNum = endNum;
      }
    }
    setBatchStartCode((maxNum + 1).toString());
    setBatchQuantity('20');
    setBatchLabel('Plage codes-barres traçabilité officielle');
    setAdminPasswordInput('');
    setAdminAuthError(null);
    setIsBarcodeModalOpen(true);
  };

  const handleBarcodeBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPassword = settings.adminPassword || 'ADMIN2026';
    if (adminPasswordInput.trim() !== expectedPassword) {
      setAdminAuthError(
        'Mot de passe Administrateur invalide. Seul un administrateur agréé peut générer une plage officielle de codes-barres.'
      );
      return;
    }

    const qty = Math.min(100, Math.max(1, parseInt(batchQuantity, 10) || 1));
    const generated = onGenerateBarcodeBatch({
      startBarcode: batchStartCode.trim(),
      quantity: qty,
      label: batchLabel.trim() || 'Lot étiquettes codes-barres',
      authorizedBy: batchAdminName.trim() || 'Administrateur',
    });

    setIsBarcodeModalOpen(false);
    setInspectedBatch(generated);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    const delta = parseInt(restockDelta, 10) || 0;
    if (delta <= 0) return;

    onAdjustStock(
      restockProduct.id,
      delta,
      restockType,
      restockNote.trim() || 'Réapprovisionnement'
    );
    setRestockProduct(null);
  };

  // Expiry evaluation
  const checkExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return { isExpiring: false, isExpired: false, label: '' };
    const exp = new Date(expiryDate).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { isExpiring: true, isExpired: true, label: 'PÉRIMÉ', days: diffDays };
    }
    if (diffDays <= 90) {
      return { isExpiring: true, isExpired: false, label: `Expire dans ${diffDays}j`, days: diffDays };
    }
    return { isExpiring: false, isExpired: false, label: `Valide (${expiryDate.slice(0, 7)})`, days: diffDays };
  };

  // Filtered products list
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

      // Stock status filter
      if (stockFilter === 'low' && (p.stock > p.minStockAlert || p.stock === 0)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (stockFilter === 'healthy' && p.stock <= p.minStockAlert) return false;
      if (stockFilter === 'prescription' && !p.requiresPrescription) return false;
      if (stockFilter === 'expiring_soon') {
        const exp = checkExpiryStatus(p.expiryDate);
        if (!exp.isExpiring) return false;
      }

      // Search term
      const q = search.trim().toLowerCase();
      if (!q) return true;

      const matchesBasic =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.supplier.toLowerCase().includes(q);

      const matchesPharma =
        (p.activeMolecule && p.activeMolecule.toLowerCase().includes(q)) ||
        (p.dosage && p.dosage.toLowerCase().includes(q)) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(q));

      const matchesSalon =
        (p.defaultStylist && p.defaultStylist.toLowerCase().includes(q)) ||
        (p.salonTier && p.salonTier.toLowerCase().includes(q));

      return matchesBasic || matchesPharma || matchesSalon;
    });
  }, [products, sectorFilter, stockFilter, search]);

  // High-level valuation metrics
  const totalStockItems = products.reduce((acc, p) => acc + p.stock, 0);
  const totalCostValuationUSD = products.reduce(
    (acc, p) => acc + p.stock * p.costPriceUSD,
    0
  );
  const totalRetailValuationUSD = products.reduce(
    (acc, p) => acc + p.stock * p.salePriceUSD,
    0
  );
  const totalExpectedProfitUSD =
    totalRetailValuationUSD - totalCostValuationUSD;

  // Specific domain counts
  const pharmaCount = products.filter((p) => p.sector === 'pharmacy').length;
  const salonLuxuryCount = products.filter(
    (p) => p.sector === 'salon' && p.salonTier === 'Haut de Gamme'
  ).length;
  const salonSimpleCount = products.filter(
    (p) => p.sector === 'salon' && p.salonTier === 'Simple'
  ).length;
  const expiringCount = products.filter(
    (p) => p.sector === 'pharmacy' && checkExpiryStatus(p.expiryDate).isExpiring
  ).length;
  const prescriptionCount = products.filter(
    (p) => p.sector === 'pharmacy' && p.requiresPrescription
  ).length;

  return (
    <div className="space-y-6">
      {/* Dynamic Sku banner feedback */}
      {skuAssignedBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-medium text-emerald-950 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{skuAssignedBanner}</span>
          </div>
          <button
            onClick={() => setSkuAssignedBanner(null)}
            className="text-emerald-700 hover:text-emerald-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              CKaisse POS — Gestion des Stocks, Dépôt & Prestations
            </h1>
            <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
              Bimétier
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Traçabilité sanitaire officine (DCI, Lots, Péremptions) & Prestations de Coiffure (Haut de Gamme VIP & Simple).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openBarcodeGeneratorModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Générer et historiser une plage de codes-barres (Accès protégé Administrateur)"
          >
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            <span>Générer Plage Codes-Barres (Admin)</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Nouvel Article ou Prestation</span>
          </button>
        </div>
      </div>

      {/* High-level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">
            Catalogue Produits & Prestations
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {products.length} références
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {pharmaCount} pharma · {salonLuxuryCount} salon VIP · {salonSimpleCount} simple
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">
            Valeur Stock au Prix d'Achat
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatMoney(
              totalCostValuationUSD,
              displayCurrency,
              settings.rates
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Investissement marchand immobilisé
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">
            Valeur Marchande Attendue
          </span>
          <div className="mt-1 text-xl font-bold text-emerald-700 font-mono tabular-nums">
            {formatMoney(
              totalRetailValuationUSD,
              displayCurrency,
              settings.rates
            )}
          </div>
          <p className="mt-1 text-[11px] text-emerald-800 font-mono tabular-nums">
            Marge prévue : +{formatMoney(totalExpectedProfitUSD, displayCurrency, settings.rates)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">
            Alertes Sanitaires & Ordonnances
          </span>
          <div className="mt-1 text-xl font-bold text-amber-700 font-mono tabular-nums">
            {expiringCount} à surveiller
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {prescriptionCount} médicaments soumis à ordonnance
          </p>
        </div>
      </div>

      {/* Filter Toolbar: Sector & Stock pills */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
        {/* Sector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-1">
            Rayon :
          </span>
          <button
            type="button"
            onClick={() => setSectorFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sectorFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setSectorFilter('pharmacy')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sectorFilter === 'pharmacy'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <HeartPulse className="h-3.5 w-3.5" />
            <span>Pharmacie & Dépôt ({pharmaCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSectorFilter('salon_luxury')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sectorFilter === 'salon_luxury'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Salon Haut de Gamme VIP ({salonLuxuryCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSectorFilter('salon_simple')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sectorFilter === 'salon_simple'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <Scissors className="h-3.5 w-3.5" />
            <span>Salon Simple & Barbier ({salonSimpleCount})</span>
          </button>
        </div>

        {/* Search & Stock condition filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par nom, DCI (principe actif), Lot, SKU, code-barres, styliste..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">État :</span>
            {[
              { id: 'all', label: 'Tous' },
              { id: 'low', label: 'Stock bas' },
              { id: 'out', label: 'Rupture' },
              { id: 'prescription', label: 'Ordonnance' },
              { id: 'expiring_soon', label: 'Péremption < 90j' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStockFilter(filter.id as any)}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  stockFilter === filter.id
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Code SKU (Auto)</th>
                <th className="px-4 py-3">Article / Prestation & Spécificités</th>
                <th className="px-4 py-3">Rayon & Gamme</th>
                <th className="px-4 py-3">Code-Barres</th>
                <th className="px-4 py-3 text-right">P. Achat HT</th>
                <th className="px-4 py-3 text-right">P. Vente TTC</th>
                <th className="px-4 py-3 text-center">Stock Disp.</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Aucun produit ou prestation ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stock === 0;
                  const isLow = p.stock > 0 && p.stock <= p.minStockAlert;
                  const expiryStatus = checkExpiryStatus(p.expiryDate);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* SKU */}
                      <td className="px-4 py-3.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                        <span className="rounded bg-slate-100 px-2 py-1 text-[11px]">
                          {p.sku}
                        </span>
                      </td>

                      {/* Product Name & Pharma/Salon attributes */}
                      <td className="px-4 py-3.5 max-w-[280px]">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {p.name}
                        </div>

                        {/* Pharma metadata */}
                        {p.sector === 'pharmacy' && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
                            {p.activeMolecule && (
                              <span className="font-mono text-emerald-800">
                                DCI: {p.activeMolecule}
                              </span>
                            )}
                            {p.dosage && (
                              <span className="text-slate-500">
                                · {p.dosage}
                              </span>
                            )}
                            {p.batchNumber && (
                              <span className="font-mono text-slate-500">
                                · Lot: {p.batchNumber}
                              </span>
                            )}
                            {p.requiresPrescription && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-semibold text-purple-800">
                                <Stethoscope className="h-2.5 w-2.5" />
                                Ordonnance
                              </span>
                            )}
                            {expiryStatus.isExpiring && (
                              <span
                                className={`rounded px-1.5 py-0.2 font-mono font-semibold ${
                                  expiryStatus.isExpired
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {expiryStatus.label}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Salon metadata */}
                        {p.sector === 'salon' && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {p.isService ? (
                              <span className="text-slate-600">
                                Prestation coiffure ({p.durationMinutes || 30} min)
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                Vente produit de soin à emporter
                              </span>
                            )}
                            {p.defaultStylist && (
                              <span className="text-slate-500 truncate max-w-[140px]">
                                · {p.defaultStylist.split('(')[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Sector / Gamme */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {p.sector === 'pharmacy' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                            <HeartPulse className="h-3 w-3" />
                            Pharmacie
                          </span>
                        ) : p.salonTier === 'Haut de Gamme' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                            <Sparkles className="h-3 w-3 text-amber-600" />
                            VIP Prestige
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
                            <Scissors className="h-3 w-3 text-blue-600" />
                            Simple / Express
                          </span>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]">
                          {p.category}
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="px-4 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3.5 w-3.5 text-slate-400" />
                          <span>{p.barcode}</span>
                        </div>
                      </td>

                      {/* Cost price */}
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-600">
                        {formatMoney(
                          p.costPriceUSD,
                          displayCurrency,
                          settings.rates
                        )}
                      </td>

                      {/* Sale price */}
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatMoney(
                          p.salePriceUSD,
                          displayCurrency,
                          settings.rates
                        )}
                      </td>

                      {/* Stock level */}
                      <td className="px-4 py-3.5 text-center font-mono tabular-nums">
                        {isOut ? (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            Rupture (0)
                          </span>
                        ) : isLow ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            {p.stock} (Alerte ≤ {p.minStockAlert})
                          </span>
                        ) : (
                          <span className="text-slate-900 font-semibold">
                            {p.stock} {p.unit}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockProduct(p);
                              setRestockDelta('10');
                            }}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            title="Réapprovisionner le stock"
                          >
                            + Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Modifier l'article"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Supprimer définitivement l'article "${p.name}" ?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Supprimer l'article"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Barcode Ranges Generation History (Admin Protected) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Historique & Traçabilité des Plages de Codes-Barres Générées (Sécurité Admin)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Chaque génération d'étiquettes est auditée et signée avec l'autorisation de l'administrateur.
            </p>
          </div>

          <button
            type="button"
            onClick={openBarcodeGeneratorModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Générer un Nouveau Lot</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Code Lot</th>
                <th className="px-3 py-2.5">Plage de Codes (Début → Fin)</th>
                <th className="px-3 py-2.5 text-center">Quantité</th>
                <th className="px-3 py-2.5">Libellé / Destination</th>
                <th className="px-3 py-2.5">Autorisé par</th>
                <th className="px-3 py-2.5">Date création</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {barcodeBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500 font-sans">
                    Aucune plage de codes-barres générée pour le moment.
                  </td>
                </tr>
              ) : (
                barcodeBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">
                      {batch.batchCode}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {batch.startBarcode} → {batch.endBarcode}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-bold">
                        {batch.quantity} codes
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-sans text-slate-800">
                      {batch.label}
                    </td>
                    <td className="px-3 py-2.5 font-sans text-emerald-800 font-medium">
                      {batch.authorizedBy}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 font-sans">
                      {formatDateTime(batch.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setInspectedBatch(batch)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspecter</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create / Edit Product or Service */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingProduct
                    ? 'Modifier Référence CKaisse'
                    : 'Enregistrer un Nouvel Article ou Prestation'}
                </h3>
                <p className="text-xs text-slate-500">
                  Le code interne ART-SKU est attribué automatiquement par le système lors de l'enregistrement.
                </p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleProductFormSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* Sector selector radio buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Secteur d'activité officiel
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                      formSector === 'pharmacy'
                        ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-semibold ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formSector"
                      value="pharmacy"
                      checked={formSector === 'pharmacy'}
                      onChange={() => {
                        setFormSector('pharmacy');
                        setFormCategory('Antibiotiques & Anti-infectieux');
                        setFormUnit('Boîte');
                      }}
                      className="sr-only"
                    />
                    <HeartPulse className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="text-xs">Pharmacie & Dépôt Pharmaceutique</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Médicaments, DCI, Lots, Péremptions & Ordonnances
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                      formSector === 'salon'
                        ? 'border-amber-600 bg-amber-50/60 text-amber-950 font-semibold ring-1 ring-amber-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formSector"
                      value="salon"
                      checked={formSector === 'salon'}
                      onChange={() => {
                        setFormSector('salon');
                        setFormCategory('Coiffure & Coupe Homme/Femme');
                        setFormUnit('Séance');
                      }}
                      className="sr-only"
                    />
                    <Scissors className="h-4 w-4 text-amber-600" />
                    <div>
                      <div className="text-xs">Salon de Coiffure & Beauté</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Prestations VIP, Formules Simples & Soins capillaires
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Basic product info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Désignation commerciale de l'article ou de la prestation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={
                      formSector === 'pharmacy'
                        ? 'Ex: Amoxicilline 500mg Gélules (Boîte 24)'
                        : 'Ex: Rituel Kératine & Soin Botox Capillaire Prestige'
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Catégorie métier
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as ProductCategory)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    {(formSector === 'pharmacy'
                      ? PHARMACY_CATEGORIES
                      : SALON_CATEGORIES
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Code-Barres EAN-13
                  </label>
                  <input
                    type="text"
                    required
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sector Specific Configuration Panel */}
              {formSector === 'pharmacy' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-950 text-xs">
                    <HeartPulse className="h-4 w-4 text-emerald-700" />
                    <span>Informations Pharmaceutiques & Traçabilité Sanitaire</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Principe Actif (DCI)
                      </label>
                      <input
                        type="text"
                        value={formActiveMolecule}
                        onChange={(e) => setFormActiveMolecule(e.target.value)}
                        placeholder="Ex: Paracétamol, Amoxicilline..."
                        className="w-full rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Dosage & Forme Galénique
                      </label>
                      <input
                        type="text"
                        value={formDosage}
                        onChange={(e) => setFormDosage(e.target.value)}
                        placeholder="Ex: 500mg Gélule, Sirop 125ml..."
                        className="w-full rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Numéro de Lot (Batch)
                      </label>
                      <input
                        type="text"
                        value={formBatchNumber}
                        onChange={(e) => setFormBatchNumber(e.target.value)}
                        placeholder="Ex: LOT-2026-08"
                        className="w-full rounded-md border border-emerald-300 bg-white font-mono px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Date de Péremption
                      </label>
                      <input
                        type="date"
                        value={formExpiryDate}
                        onChange={(e) => setFormExpiryDate(e.target.value)}
                        className="w-full rounded-md border border-emerald-300 bg-white font-mono px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequiresPrescription}
                      onChange={(e) =>
                        setFormRequiresPrescription(e.target.checked)
                      }
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-600"
                    />
                    <span className="text-xs font-semibold text-purple-900">
                      Délivrance sur ordonnance médicale obligatoire (médicament sous contrôle)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-950 text-xs">
                    <Scissors className="h-4 w-4 text-amber-700" />
                    <span>Configuration Salon de Coiffure (Haut de Gamme VIP vs Simple)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Gamme du Salon
                      </label>
                      <select
                        value={formSalonTier}
                        onChange={(e) =>
                          setFormSalonTier(e.target.value as SalonTier)
                        }
                        className="w-full rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-amber-700 focus:outline-none"
                      >
                        <option value="Haut de Gamme">
                          ⭐ Haut de Gamme VIP (Prestige & Spa)
                        </option>
                        <option value="Simple">
                          ✂️ Simple (Coupe express & Barbier)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Styliste / Barbier assigné par défaut
                      </label>
                      <select
                        value={formDefaultStylist}
                        onChange={(e) => setFormDefaultStylist(e.target.value)}
                        className="w-full rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-700 focus:outline-none"
                      >
                        {settings.availableStylists?.map((sty) => (
                          <option key={sty} value={sty}>
                            {sty}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Type d'article
                      </label>
                      <div className="flex items-center gap-4 mt-1">
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-800">
                          <input
                            type="radio"
                            name="salonIsService"
                            checked={formIsService}
                            onChange={() => setFormIsService(true)}
                          />
                          Prestation en salon
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-800">
                          <input
                            type="radio"
                            name="salonIsService"
                            checked={!formIsService}
                            onChange={() => setFormIsService(false)}
                          />
                          Produit à emporter
                        </label>
                      </div>
                    </div>

                    {formIsService && (
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Durée estimée (minutes)
                        </label>
                        <input
                          type="number"
                          min="5"
                          step="5"
                          value={formDurationMinutes}
                          onChange={(e) =>
                            setFormDurationMinutes(e.target.value)
                          }
                          className="w-full rounded-md border border-amber-300 bg-white font-mono px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-700 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing & Stock Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Prix Achat HT ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formCostUSD}
                    onChange={(e) => setFormCostUSD(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Prix Vente TTC ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formSaleUSD}
                    onChange={(e) => setFormSaleUSD(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono font-semibold px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Quantité Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Alerte Seuil Bas
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Unité de délivrance
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="Boîte, Flacon, Tube, Séance..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Fournisseur / Laboratoire / Marque
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Ex: Pharma Dépôt Central, L'Oréal Luxe..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {editingProduct ? 'Mettre à jour' : 'Enregistrer (SKU Auto)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Generate Barcode Range (Admin Password Protected) */}
      {isBarcodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Générateur Officiel de Plage Codes-Barres
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Protection Administrateur requise pour la traçabilité.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBarcodeModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBarcodeBatchSubmit} className="p-6 space-y-4">
              {adminAuthError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
                  {adminAuthError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Premier code-barres de la plage
                  </label>
                  <input
                    type="text"
                    required
                    value={batchStartCode}
                    onChange={(e) => setBatchStartCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Quantité de codes à générer
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Motif / Désignation du lot
                </label>
                <input
                  type="text"
                  required
                  value={batchLabel}
                  onChange={(e) => setBatchLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom du responsable autorisé
                </label>
                <input
                  type="text"
                  required
                  value={batchAdminName}
                  onChange={(e) => setBatchAdminName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Admin password authorization */}
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                  <Lock className="h-3.5 w-3.5 text-amber-700" />
                  <span>Validation Sécurité Administrateur</span>
                </div>
                <p className="text-[11px] text-amber-900">
                  Saisissez le mot de passe administrateur (Par défaut :{' '}
                  <code className="rounded bg-amber-200 px-1 py-0.5 font-mono text-[10px]">
                    {settings.adminPassword || 'ADMIN2026'}
                  </code>
                  ).
                </p>
                <input
                  type="password"
                  required
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Mot de passe admin..."
                  className="w-full rounded-md border border-amber-400 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBarcodeModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 shadow-xs"
                >
                  Générer et Signer le Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inspect Generated Barcode Batch */}
      {inspectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
          <div className="relative max-h-[88vh] w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Plage de Codes-Barres : {inspectedBatch.batchCode}
                </h3>
                <p className="text-xs text-slate-500">
                  {inspectedBatch.quantity} codes EAN-13 générés et enregistrés dans l'historique
                </p>
              </div>
              <button
                onClick={() => setInspectedBatch(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Libellé :</span>
                  <div className="font-semibold text-slate-900">
                    {inspectedBatch.label}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Autorisé par :</span>
                  <div className="font-semibold text-emerald-800">
                    {inspectedBatch.authorizedBy}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                  Liste des {inspectedBatch.codes.length} codes-barres :
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                  {inspectedBatch.codes.map((code) => {
                    const isUsed = usedBarcodesSet.has(code);
                    return (
                      <div
                        key={code}
                        className={`rounded border p-2 text-center ${
                          isUsed
                            ? 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-950 font-bold'
                        }`}
                      >
                        {code}
                        <div className="text-[9px] font-sans font-normal mt-0.5">
                          {isUsed ? 'Déjà associé' : 'Disponible'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-between items-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimer les Étiquettes</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectedBatch(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Quick Restock */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Réapprovisionnement Stock
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {restockProduct.name} ({restockProduct.sku})
                </p>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-6 space-y-4 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500">Stock actuel :</span>
                <span className="ml-2 font-mono font-bold text-slate-900">
                  {restockProduct.stock} {restockProduct.unit}s
                </span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Quantité reçue à ajouter au stock *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockDelta}
                  onChange={(e) => setRestockDelta(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Motif / Référence Bon de Livraison (BL)
                </label>
                <input
                  type="text"
                  required
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="Ex: Livraison grossiste BL #4092..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Valider l'Entrée en Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
