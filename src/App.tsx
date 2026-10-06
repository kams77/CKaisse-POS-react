/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AccessLogEntry,
  BarcodeBatchRecord,
  BusinessSector,
  CartItem,
  CurrencyCode,
  Customer,
  EventCategory,
  EventTicketPass,
  FintechRail,
  FintechTransaction,
  InvoiceRecord,
  MerchantPayout,
  MobileMoneyOperator,
  OrganizerPayout,
  PaymentLinkItem,
  PaymentMethod,
  Product,
  SaaSTenant,
  SaleRecord,
  StockMovement,
  StoreSettings,
  TicketingEvent,
  UserRole,
  UserSession,
  OfflineScanItem,
} from './types';
import {
  INITIAL_ACCESS_LOGS,
  INITIAL_BARCODE_BATCHES,
  INITIAL_CUSTOMERS,
  INITIAL_EVENTS,
  INITIAL_FINTECH_TRANSACTIONS,
  INITIAL_INVOICES,
  INITIAL_ORGANIZER_PAYOUTS,
  INITIAL_PAYMENT_LINKS,
  INITIAL_PAYOUTS,
  INITIAL_PRODUCTS,
  INITIAL_SAAS_TENANTS,
  INITIAL_SALES,
  INITIAL_SETTINGS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_TICKET_PASSES,
  INITIAL_USER_SESSIONS,
} from './data/initialData';
import { generateSecurePassCode, generateTicketJwt } from './utils/cryptoJwt';
import { PosTerminalView } from './components/PosTerminalView';
import {
  buildAutoSkuPreview,
  InventoryView,
} from './components/InventoryView';
import { SalesReportView } from './components/SalesReportView';
import { CustomersView } from './components/CustomersView';
import { SaaSBusinessView } from './components/SaaSBusinessView';
import { FintechProjectView } from './components/FintechProjectView';
import {
  SubTab,
  TicketingProjectView,
} from './components/TicketingProjectView';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { formatMoney } from './utils/format';

type ActiveTab =
  | 'ticketing'
  | 'fintech'
  | 'pos'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'saas';

const STORAGE_KEYS = {
  products: 'kolapos_products_v1',
  customers: 'kolapos_customers_v1',
  sales: 'kolapos_sales_v1',
  movements: 'kolapos_movements_v1',
  barcodeBatches: 'kolapos_barcode_batches_v1',
  tenants: 'kolapos_tenants_v1',
  settings: 'kolapos_settings_v1',
  paymentLinks: 'kolapay_links_v1',
  invoices: 'kolapay_invoices_v1',
  fintechTx: 'kolapay_transactions_v1',
  payouts: 'kolapay_payouts_v1',
  events: 'kolapass_events_v1',
  ticketPasses: 'kolapass_passes_v1',
  accessLogs: 'kolapass_access_logs_v1',
  organizerPayouts: 'kolapass_org_payouts_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Platform focused exclusively on KolaPass (Projet Billetterie & Contrôle d'Accès)
  const [activeTab, setActiveTab] = useState<ActiveTab>('ticketing');
  const [ticketingSubTab, setTicketingSubTab] = useState<SubTab>('events');

  const [settings, setSettings] = useState<StoreSettings>(() =>
    loadFromStorage(STORAGE_KEYS.settings, INITIAL_SETTINGS)
  );
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(
    settings.defaultCurrency || 'USD'
  );

  // Pharmacy & Salon specific cart states
  const [prescriptionRef, setPrescriptionRef] = useState('ORD-2026-9041');
  const [prescribingDoctor, setPrescribingDoctor] = useState('Dr. Kasongo (Clinique Centrale)');
  const [assignedStylist, setAssignedStylist] = useState(settings.availableStylists?.[0] || 'Jean-Marc (VIP)');
  const [tipAmountUSD, setTipAmountUSD] = useState(0);

  // Project 1 State (KolaPOS)
  const [products, setProducts] = useState<Product[]>(() =>
    loadFromStorage(STORAGE_KEYS.products, INITIAL_PRODUCTS)
  );
  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadFromStorage(STORAGE_KEYS.customers, INITIAL_CUSTOMERS)
  );
  const [sales, setSales] = useState<SaleRecord[]>(() =>
    loadFromStorage(STORAGE_KEYS.sales, INITIAL_SALES)
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    loadFromStorage(STORAGE_KEYS.movements, INITIAL_STOCK_MOVEMENTS)
  );
  const [barcodeBatches, setBarcodeBatches] = useState<BarcodeBatchRecord[]>(
    () =>
      loadFromStorage(STORAGE_KEYS.barcodeBatches, INITIAL_BARCODE_BATCHES)
  );
  const [tenants, setTenants] = useState<SaaSTenant[]>(() =>
    loadFromStorage(STORAGE_KEYS.tenants, INITIAL_SAAS_TENANTS)
  );

  // Project 2 State (KolaPay FinTech & API)
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.paymentLinks, INITIAL_PAYMENT_LINKS)
  );
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() =>
    loadFromStorage(STORAGE_KEYS.invoices, INITIAL_INVOICES)
  );
  const [fintechTransactions, setFintechTransactions] = useState<
    FintechTransaction[]
  >(() => loadFromStorage(STORAGE_KEYS.fintechTx, INITIAL_FINTECH_TRANSACTIONS));
  const [payouts, setPayouts] = useState<MerchantPayout[]>(() =>
    loadFromStorage(STORAGE_KEYS.payouts, INITIAL_PAYOUTS)
  );

  // Project 3 State (KolaPass Ticketing & QR Access Control)
  const [events, setEvents] = useState<TicketingEvent[]>(() =>
    loadFromStorage(STORAGE_KEYS.events, INITIAL_EVENTS)
  );
  const [ticketPasses, setTicketPasses] = useState<EventTicketPass[]>(() =>
    loadFromStorage(STORAGE_KEYS.ticketPasses, INITIAL_TICKET_PASSES)
  );
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>(() =>
    loadFromStorage(STORAGE_KEYS.accessLogs, INITIAL_ACCESS_LOGS)
  );
  const [organizerPayouts, setOrganizerPayouts] = useState<OrganizerPayout[]>(() =>
    loadFromStorage(STORAGE_KEYS.organizerPayouts, INITIAL_ORGANIZER_PAYOUTS)
  );

  // Active POS Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [inspectedSale, setInspectedSale] = useState<SaleRecord | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    } catch {
      // ignore
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
    } catch {
      // ignore
    }
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(sales));
    } catch {
      // ignore
    }
  }, [sales]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.movements,
        JSON.stringify(stockMovements)
      );
    } catch {
      // ignore
    }
  }, [stockMovements]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.barcodeBatches,
        JSON.stringify(barcodeBatches)
      );
    } catch {
      // ignore
    }
  }, [barcodeBatches]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));
    } catch {
      // ignore
    }
  }, [tenants]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.paymentLinks,
        JSON.stringify(paymentLinks)
      );
    } catch {
      // ignore
    }
  }, [paymentLinks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
    } catch {
      // ignore
    }
  }, [invoices]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.fintechTx,
        JSON.stringify(fintechTransactions)
      );
    } catch {
      // ignore
    }
  }, [fintechTransactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.payouts, JSON.stringify(payouts));
    } catch {
      // ignore
    }
  }, [payouts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
    } catch {
      // ignore
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.ticketPasses,
        JSON.stringify(ticketPasses)
      );
    } catch {
      // ignore
    }
  }, [ticketPasses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.accessLogs, JSON.stringify(accessLogs));
    } catch {
      // ignore
    }
  }, [accessLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.organizerPayouts,
        JSON.stringify(organizerPayouts)
      );
    } catch {
      // ignore
    }
  }, [organizerPayouts]);

  // Cart handlers (Project 1 : CKaisse POS)
  const handleAddToCart = (product: Product, options?: Partial<CartItem>) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      if (product.stock <= 0) return prev;
      return [
        ...prev,
        {
          product,
          quantity: 1,
          discountPercent: 0,
          assignedStylist: options?.assignedStylist || product.defaultStylist || assignedStylist,
          salonTier: options?.salonTier || product.salonTier,
        },
      ];
    });
  };

  const handleUpdateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const clamped = Math.min(item.product.stock, newQty);
        return { ...item, quantity: clamped };
      })
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setGlobalDiscountPercent(0);
    setTipAmountUSD(0);
  };

  const rawSubtotalUSD = cart.reduce(
    (sum, item) => sum + item.product.salePriceUSD * item.quantity,
    0
  );
  const discountUSD =
    rawSubtotalUSD * (Math.min(100, Math.max(0, globalDiscountPercent)) / 100);
  const netSubtotalUSD = Math.max(0, rawSubtotalUSD - discountUSD);
  const taxUSD = netSubtotalUSD * (settings.taxRatePercent / 100);
  const totalUSD = netSubtotalUSD + taxUSD + (tipAmountUSD > 0 ? tipAmountUSD : 0);

  const selectedCustomer =
    customers.find((c) => c.id === selectedCustomerId) || null;

  const handleConfirmPayment = (details: {
    paymentMethod: PaymentMethod;
    mobileOperator?: MobileMoneyOperator;
    mobilePhone?: string;
    transactionRef?: string;
    amountTenderedUSD: number;
    changeDueUSD: number;
    note?: string;
  }) => {
    const nowIso = new Date().toISOString();
    const receiptNumber = `TKT-2026-${(841 + sales.length)
      .toString()
      .padStart(4, '0')}`;

    const snapshots = cart.map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      quantity: item.quantity,
      unitPriceUSD: item.product.salePriceUSD,
      costPriceUSD: item.product.costPriceUSD,
      discountPercent: globalDiscountPercent,
      lineTotalUSD:
        item.product.salePriceUSD *
        item.quantity *
        (1 - globalDiscountPercent / 100),
      dosage: item.product.dosage,
      batchNumber: item.product.batchNumber,
      expiryDate: item.product.expiryDate,
      requiresPrescription: item.product.requiresPrescription,
      assignedStylist: item.assignedStylist || assignedStylist,
      salonTier: item.salonTier || item.product.salonTier,
      isService: item.product.isService,
    }));

    const totalCostUSD = cart.reduce(
      (sum, item) => sum + item.product.costPriceUSD * item.quantity,
      0
    );
    const profitUSD = netSubtotalUSD - totalCostUSD;

    const saleSector: BusinessSector = cart.some(
      (i) => i.product.sector === 'salon'
    )
      ? 'salon'
      : 'pharmacy';

    const newSale: SaleRecord = {
      id: `sale-${Date.now()}`,
      receiptNumber,
      createdAt: nowIso,
      cashierName: settings.cashierName,
      sector: saleSector,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer
        ? selectedCustomer.name
        : saleSector === 'pharmacy'
        ? 'Patient Comptoir'
        : 'Client Salon Comptoir',
      customerPhone: selectedCustomer?.phone || details.mobilePhone,
      prescriptionRef: prescriptionRef.trim() || undefined,
      prescribingDoctor: prescribingDoctor.trim() || undefined,
      assignedStylist: assignedStylist.trim() || undefined,
      tipAmountUSD: tipAmountUSD > 0 ? tipAmountUSD : undefined,
      items: snapshots,
      subtotalUSD: rawSubtotalUSD,
      discountUSD,
      taxUSD,
      totalUSD,
      profitUSD,
      currencyUsed: displayCurrency,
      exchangeRateUsed: settings.rates[displayCurrency] || 1,
      paymentMethod: details.paymentMethod,
      mobileOperator: details.mobileOperator,
      mobilePhone: details.mobilePhone,
      transactionRef: details.transactionRef,
      amountTenderedUSD: details.amountTenderedUSD,
      changeDueUSD: details.changeDueUSD,
      status: 'completed',
      note: details.note,
    };

    const newMovements: StockMovement[] = [];
    setProducts((prevProducts) =>
      prevProducts.map((prod) => {
        const cartLine = cart.find((c) => c.product.id === prod.id);
        if (!cartLine) return prod;
        const nextStock = Math.max(0, prod.stock - cartLine.quantity);
        newMovements.push({
          id: `mov-${Date.now()}-${prod.id}`,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'sale',
          quantityDelta: -cartLine.quantity,
          previousStock: prod.stock,
          newStock: nextStock,
          note: `Vente Ticket ${receiptNumber}`,
          createdAt: nowIso,
        });
        return { ...prod, stock: nextStock, updatedAt: nowIso };
      })
    );

    setStockMovements((prev) => [...newMovements, ...prev]);

    if (selectedCustomer) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== selectedCustomer.id) return c;
          return {
            ...c,
            totalPurchasesUSD: c.totalPurchasesUSD + totalUSD,
            creditBalanceUSD:
              details.paymentMethod === 'credit'
                ? c.creditBalanceUSD + totalUSD
                : c.creditBalanceUSD,
            lastVisit: nowIso,
          };
        })
      );
    }

    setSales((prev) => [newSale, ...prev]);
    setCart([]);
    setGlobalDiscountPercent(0);
    setIsPaymentModalOpen(false);
    setInspectedSale(newSale);
  };

  const handleQuickAddCustomer = (name: string, phone: string): Customer => {
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name,
      phone,
      totalPurchasesUSD: 0,
      creditBalanceUSD: 0,
      lastVisit: new Date().toISOString(),
    };
    setCustomers((prev) => [newCust, ...prev]);
    return newCust;
  };

  const handleSaveProduct = (
    productData: Omit<Product, 'id' | 'updatedAt' | 'sku'>,
    existingId?: string
  ): Product => {
    const nowIso = new Date().toISOString();
    if (existingId) {
      const existingProd = products.find((p) => p.id === existingId);
      const preservedSku =
        existingProd?.sku ||
        buildAutoSkuPreview(
          productData.category,
          products.length,
          productData.sector,
          productData.salonTier
        );
      const updatedProduct: Product = {
        ...productData,
        id: existingId,
        sku: preservedSku,
        updatedAt: nowIso,
      };
      setProducts((prev) =>
        prev.map((p) => (p.id === existingId ? updatedProduct : p))
      );
      return updatedProduct;
    } else {
      const autoSku = buildAutoSkuPreview(
        productData.category,
        products.length,
        productData.sector,
        productData.salonTier
      );
      const created: Product = {
        ...productData,
        id: `prod-${Date.now()}`,
        sku: autoSku,
        updatedAt: nowIso,
      };
      setProducts((prev) => [created, ...prev]);
      setStockMovements((prev) => [
        {
          id: `mov-${Date.now()}`,
          productId: created.id,
          productName: created.name,
          sku: created.sku,
          type: 'in',
          quantityDelta: created.stock,
          previousStock: 0,
          newStock: created.stock,
          note: `Création fiche article (Attribution auto ${autoSku})`,
          createdAt: nowIso,
        },
        ...prev,
      ]);
      return created;
    }
  };

  const handleGenerateBarcodeBatch = (batchData: {
    startBarcode: string;
    quantity: number;
    label: string;
    authorizedBy: string;
  }): BarcodeBatchRecord => {
    const startBig = BigInt(batchData.startBarcode || '6181100050001');
    const codes: string[] = [];
    for (let i = 0; i < batchData.quantity; i++) {
      codes.push((startBig + BigInt(i)).toString());
    }
    const endBarcode = codes[codes.length - 1] || batchData.startBarcode;
    const nextLotNum = (barcodeBatches.length + 1)
      .toString()
      .padStart(2, '0');

    const newBatch: BarcodeBatchRecord = {
      id: `batch-${Date.now()}`,
      batchCode: `LOT-EAN-2026-${nextLotNum}`,
      startBarcode: batchData.startBarcode,
      endBarcode,
      quantity: batchData.quantity,
      codes,
      label: batchData.label,
      authorizedBy: batchData.authorizedBy,
      createdAt: new Date().toISOString(),
    };

    setBarcodeBatches((prev) => [newBatch, ...prev]);
    return newBatch;
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleAdjustStock = (
    productId: string,
    quantityDelta: number,
    type: 'in' | 'adjustment',
    note: string
  ) => {
    const nowIso = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const nextStock = Math.max(0, p.stock + quantityDelta);
        setStockMovements((movs) => [
          {
            id: `mov-${Date.now()}`,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            type,
            quantityDelta,
            previousStock: p.stock,
            newStock: nextStock,
            note,
            createdAt: nowIso,
          },
          ...movs,
        ]);
        return { ...p, stock: nextStock, updatedAt: nowIso };
      })
    );
  };

  const handleRefundSale = (saleId: string) => {
    const target = sales.find((s) => s.id === saleId);
    if (!target || target.status === 'refunded') return;
    const nowIso = new Date().toISOString();

    setSales((prev) =>
      prev.map((s) => (s.id === saleId ? { ...s, status: 'refunded' } : s))
    );

    const restoredMovements: StockMovement[] = [];
    setProducts((prev) =>
      prev.map((p) => {
        const soldItem = target.items.find((i) => i.productId === p.id);
        if (!soldItem) return p;
        const nextStock = p.stock + soldItem.quantity;
        restoredMovements.push({
          id: `mov-ref-${Date.now()}-${p.id}`,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          type: 'refund',
          quantityDelta: soldItem.quantity,
          previousStock: p.stock,
          newStock: nextStock,
          note: `Annulation / Retour Ticket ${target.receiptNumber}`,
          createdAt: nowIso,
        });
        return { ...p, stock: nextStock, updatedAt: nowIso };
      })
    );
    setStockMovements((prev) => [...restoredMovements, ...prev]);
  };

  const handleRecordDebtPayment = (
    customerId: string,
    amountPaidUSD: number
  ) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          creditBalanceUSD: Math.max(0, c.creditBalanceUSD - amountPaidUSD),
          lastVisit: new Date().toISOString(),
        };
      })
    );
  };

  const handleAddTenant = (
    tenantData: Omit<SaaSTenant, 'id' | 'joinedAt' | 'licenseKey'>
  ) => {
    const prefix = tenantData.plan.slice(0, 3).toUpperCase();
    const cityCode = tenantData.city.slice(0, 3).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const created: SaaSTenant = {
      ...tenantData,
      id: `tenant-${Date.now()}`,
      joinedAt: new Date().toISOString().slice(0, 10),
      licenseKey: `CKAISSE-${prefix}-${randomNum}-${cityCode}`,
    };
    setTenants((prev) => [created, ...prev]);
  };

  const handleUpdateTenantStatus = (
    tenantId: string,
    billingStatus: SaaSTenant['billingStatus']
  ) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, billingStatus } : t))
    );
  };

  // =========================================================================
  // Project 2 Handlers (KolaPay FinTech, Payment Links, Invoices & API)
  // =========================================================================

  const handleCreatePaymentLink = (
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
  ): PaymentLinkItem => {
    const nextCode = `PAY-KOLA-${Math.floor(100 + Math.random() * 900)}`;
    const created: PaymentLinkItem = {
      ...data,
      id: `plink-${Date.now()}`,
      shortCode: nextCode,
      clicksCount: 1,
      salesCount: 0,
      totalCollectedUSD: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    setPaymentLinks((prev) => [created, ...prev]);
    return created;
  };

  const handleCreateInvoice = (
    data: Omit<InvoiceRecord, 'id' | 'invoiceNumber' | 'status' | 'createdAt'>
  ): InvoiceRecord => {
    const invNum = `FAC-2026-${(401 + invoices.length)
      .toString()
      .padStart(4, '0')}`;
    const created: InvoiceRecord = {
      ...data,
      id: `inv-${Date.now()}`,
      invoiceNumber: invNum,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setInvoices((prev) => [created, ...prev]);
    return created;
  };

  const handleProcessCheckoutPayment = (payload: {
    sourceType: FintechTransaction['sourceType'];
    sourceId?: string;
    sourceTitle: string;
    customerName: string;
    customerPhone: string;
    amountUSD: number;
    paymentRail: FintechRail;
  }) => {
    const feeUSD = Number((payload.amountUSD * 0.02).toFixed(2));
    const netUSD = Number((payload.amountUSD - feeUSD).toFixed(2));
    const nowIso = new Date().toISOString();

    const newTx: FintechTransaction = {
      id: `ftx-${Date.now()}`,
      reference: `pi_kola_${Math.random().toString(16).slice(2, 10)}`,
      sourceType: payload.sourceType,
      sourceTitle: payload.sourceTitle,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      grossAmountUSD: payload.amountUSD,
      platformFeeUSD: feeUSD,
      netMerchantUSD: netUSD,
      paymentRail: payload.paymentRail,
      status: 'succeeded',
      webhookStatus: '200 OK',
      webhookSignature: `t=${Math.floor(
        Date.now() / 1000
      )},v1=${Math.random().toString(16).slice(2, 18)}`,
      createdAt: nowIso,
    };

    setFintechTransactions((prev) => [newTx, ...prev]);

    if (payload.sourceType === 'payment_link' && payload.sourceId) {
      setPaymentLinks((prev) =>
        prev.map((link) =>
          link.id === payload.sourceId
            ? {
                ...link,
                clicksCount: link.clicksCount + 1,
                salesCount: link.salesCount + 1,
                totalCollectedUSD: link.totalCollectedUSD + payload.amountUSD,
              }
            : link
        )
      );
    }

    if (payload.sourceType === 'invoice' && payload.sourceId) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === payload.sourceId
            ? {
                ...inv,
                status: 'paid',
                paidAt: nowIso,
                paymentRail: payload.paymentRail,
              }
            : inv
        )
      );
    }
  };

  const handleRequestPayout = (amountUSD: number, destination: string) => {
    const newPayout: MerchantPayout = {
      id: `pay-${Date.now()}`,
      amountUSD,
      destination,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    setPayouts((prev) => [newPayout, ...prev]);
  };

  // =========================================================================
  // Project 3 Handlers (KolaPass Event Ticketing & QR Scanner)
  // =========================================================================

  const handleCreateEvent = (data: {
    title: string;
    category: EventCategory;
    organizerName: string;
    organizerPhone: string;
    venue: string;
    city: string;
    eventDate: string;
    standardPriceUSD: number;
    standardCap: number;
    vipPriceUSD: number;
    vipCap: number;
    vvipPriceUSD: number;
    vvipCap: number;
  }): TicketingEvent => {
    const nextNum = (events.length + 1).toString().padStart(2, '0');
    const created: TicketingEvent = {
      id: `evt-${Date.now()}`,
      code: `EVT-KOLA-2026-${nextNum}`,
      title: data.title,
      category: data.category,
      organizerName: data.organizerName,
      organizerPhone: data.organizerPhone,
      venue: data.venue,
      city: data.city,
      eventDate: data.eventDate,
      commissionRatePercent: 7.0,
      status: 'upcoming',
      createdAt: new Date().toISOString(),
      tiers: [
        {
          id: `t-std-${Date.now()}`,
          name: 'Standard',
          priceUSD: data.standardPriceUSD,
          capacity: data.standardCap,
          sold: 0,
        },
        {
          id: `t-vip-${Date.now()}`,
          name: 'VIP',
          priceUSD: data.vipPriceUSD,
          capacity: data.vipCap,
          sold: 0,
        },
        {
          id: `t-vvip-${Date.now()}`,
          name: 'VVIP',
          priceUSD: data.vvipPriceUSD,
          capacity: data.vvipCap,
          sold: 0,
        },
      ],
    };
    setEvents((prev) => [created, ...prev]);
    return created;
  };

  const [userSession, setUserSession] = useState<UserSession>(() =>
    loadFromStorage('kolapass_user_session_v1', INITIAL_USER_SESSIONS.admin)
  );

  useEffect(() => {
    try {
      localStorage.setItem('kolapass_user_session_v1', JSON.stringify(userSession));
    } catch {
      // ignore
    }
  }, [userSession]);

  const handlePurchaseTicketPass = (payload: {
    eventId: string;
    tierName: 'Standard' | 'VIP' | 'VVIP';
    holderName: string;
    holderPhone: string;
    paymentRail: FintechRail;
    quantity?: number;
    discountPercent?: number;
    guestNames?: string[];
  }): EventTicketPass[] => {
    const targetEvent = events.find((e) => e.id === payload.eventId);
    if (!targetEvent) return [];
    const tierObj = targetEvent.tiers.find((t) => t.name === payload.tierName);
    const basePriceUSD = tierObj ? tierObj.priceUSD : 25;
    const qty = Math.max(1, payload.quantity || 1);
    const discountRate =
      Math.min(50, Math.max(0, payload.discountPercent || 0)) / 100;
    const finalUnitPrice = basePriceUSD * (1 - discountRate);

    const createdPasses: EventTicketPass[] = [];
    const txRef = `${payload.paymentRail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()}-TX-${Date.now()}`;

    for (let i = 0; i < qty; i++) {
      const guestName =
        qty === 1
          ? payload.holderName
          : payload.guestNames?.[i]?.trim() ||
            `${payload.holderName} (Invité #${i + 1})`;

      const feeUSD = Number((finalUnitPrice * 0.07).toFixed(2));
      const netUSD = Number((finalUnitPrice - feeUSD).toFixed(2));

      // Cryptographically non-sequential pass code (Format: EVT123-8F3K9X2Q)
      const securePassCode = generateSecurePassCode(targetEvent.code);

      // Sign with JWT + HMAC-SHA256
      const { jwtToken, signature, fullQrData } = generateTicketJwt({
        jti: `tkt-${Date.now()}-${i}`,
        evt: targetEvent.id,
        evtTitle: targetEvent.title,
        tier: payload.tierName,
        name: guestName,
        phone: payload.holderPhone,
        code: securePassCode,
      });

      const newPass: EventTicketPass = {
        id: `pass-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        passCode: securePassCode,
        qrSignature: `HMAC-SHA256:${signature}`,
        jwtToken,
        qrPayload: fullQrData,
        avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + (i * 200)}?w=150&auto=format&fit=crop&q=80`,
        eventId: targetEvent.id,
        eventTitle: targetEvent.title,
        eventDate: targetEvent.eventDate,
        venue: targetEvent.venue,
        tierName: payload.tierName,
        holderName: guestName,
        holderPhone: payload.holderPhone,
        pricePaidUSD: Number(finalUnitPrice.toFixed(2)),
        platformFeeUSD: feeUSD,
        netOrganizerUSD: netUSD,
        paymentRail: payload.paymentRail,
        transactionReference: txRef,
        status: 'valid',
        scanAttempts: 0,
        purchasedAt: new Date().toISOString(),
      };

      createdPasses.push(newPass);
    }

    setTicketPasses((prev) => [...createdPasses, ...prev]);

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== targetEvent.id) return ev;
        return {
          ...ev,
          tiers: ev.tiers.map((t) =>
            t.name === payload.tierName ? { ...t, sold: t.sold + qty } : t
          ),
        };
      })
    );

    return createdPasses;
  };

  const handleScanTicketPass = (
    passCode: string,
    gate: string = 'Porte A (VIP / VVIP)',
    scannedBy: string = 'Agent Sécurité Cédric'
  ): {
    outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found' | 'blacklisted';
    pass?: EventTicketPass;
    previousCheckIn?: string;
  } => {
    // Extract base code in case a dynamic code with #rollingHash was scanned
    const cleanCode = passCode.split('#')[0].trim().toUpperCase();
    const targetPass = ticketPasses.find(
      (p) => p.passCode.toUpperCase() === cleanCode
    );
    const nowIso = new Date().toISOString();

    if (!targetPass) {
      const logEntry: AccessLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        passCode: cleanCode,
        holderName: 'Inconnu',
        eventTitle: 'Non identifié',
        tierName: 'N/A',
        gate,
        scannedBy,
        result: 'invalid_unknown',
        notes: 'Code QR non répertorié ou contrefait',
      };
      setAccessLogs((prev) => [logEntry, ...prev]);
      return { outcome: 'not_found' };
    }

    // Check if blacklisted
    if (targetPass.status === 'blacklisted') {
      const updatedPass: EventTicketPass = {
        ...targetPass,
        scanAttempts: targetPass.scanAttempts + 1,
      };
      setTicketPasses((prev) =>
        prev.map((p) => (p.id === targetPass.id ? updatedPass : p))
      );

      const logEntry: AccessLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        passCode: targetPass.passCode,
        holderName: targetPass.holderName,
        eventTitle: targetPass.eventTitle,
        tierName: targetPass.tierName,
        gate,
        scannedBy,
        result: 'blacklisted_denied',
        notes: `REFUS CRITIQUE: Billet sur liste noire (${targetPass.blacklistReason || 'Opposition'})`,
      };
      setAccessLogs((prev) => [logEntry, ...prev]);
      return { outcome: 'blacklisted', pass: updatedPass };
    }

    if (targetPass.status === 'valid') {
      const updatedPass: EventTicketPass = {
        ...targetPass,
        status: 'used',
        checkedInAt: nowIso,
        checkedInGate: gate,
        checkedInBy: scannedBy,
        scanAttempts: 1,
      };
      setTicketPasses((prev) =>
        prev.map((p) => (p.id === targetPass.id ? updatedPass : p))
      );

      const logEntry: AccessLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        passCode: targetPass.passCode,
        holderName: targetPass.holderName,
        eventTitle: targetPass.eventTitle,
        tierName: targetPass.tierName,
        gate,
        scannedBy,
        result: 'granted',
        notes: `Entrée autorisée — Pass ${targetPass.tierName}`,
      };
      setAccessLogs((prev) => [logEntry, ...prev]);

      return { outcome: 'valid_entry', pass: updatedPass };
    } else {
      // Duplicate / Already Used
      const previousCheckIn = targetPass.checkedInAt;
      const updatedPass: EventTicketPass = {
        ...targetPass,
        scanAttempts: targetPass.scanAttempts + 1,
      };
      setTicketPasses((prev) =>
        prev.map((p) => (p.id === targetPass.id ? updatedPass : p))
      );

      const logEntry: AccessLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        passCode: targetPass.passCode,
        holderName: targetPass.holderName,
        eventTitle: targetPass.eventTitle,
        tierName: targetPass.tierName,
        gate,
        scannedBy,
        result: 'duplicate_denied',
        notes: `FRAUDE DOUBLON: Déjà émargé le ${
          previousCheckIn ? new Date(previousCheckIn).toLocaleTimeString('fr-FR') : ''
        } (${targetPass.checkedInGate || 'Porte A'})`,
      };
      setAccessLogs((prev) => [logEntry, ...prev]);

      return {
        outcome: 'fraud_duplicate',
        pass: updatedPass,
        previousCheckIn,
      };
    }
  };

  const handleBlacklistTicketPass = (passId: string, reason: string) => {
    const nowIso = new Date().toISOString();
    setTicketPasses((prev) =>
      prev.map((p) =>
        p.id === passId
          ? {
              ...p,
              status: 'blacklisted',
              blacklistReason: reason,
              blacklistedAt: nowIso,
            }
          : p
      )
    );
  };

  const handleReactivateTicketPass = (passId: string) => {
    setTicketPasses((prev) =>
      prev.map((p) =>
        p.id === passId
          ? {
              ...p,
              status: 'valid',
              blacklistReason: undefined,
              blacklistedAt: undefined,
            }
          : p
      )
    );
  };

  const handleSyncOfflineScans = (scans: OfflineScanItem[]) => {
    if (!scans || scans.length === 0) return;
    const newLogs: AccessLogEntry[] = scans.map((s) => ({
      id: `log-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: s.timestamp,
      passCode: s.passCode,
      holderName: 'Participant Hors-ligne',
      eventTitle: 'Scan différé stade',
      tierName: 'Vérifié localement',
      gate: s.gate,
      scannedBy: `${s.scannedBy} (Sync Hors-Ligne)`,
      result: s.outcome === 'valid_entry' ? 'granted' : 'duplicate_denied',
      notes: `Synchronisé depuis le tampon réseau hors-ligne du stade à ${new Date().toLocaleTimeString('fr-FR')}`,
      offlineSynced: true,
    }));
    setAccessLogs((prev) => [...newLogs, ...prev]);
  };

  const handleRequestOrganizerPayout = (payload: {
    eventId: string;
    amountUSD: number;
    paymentRail: FintechRail;
    destinationAccount: string;
  }) => {
    const targetEvent = events.find((e) => e.id === payload.eventId);
    const newPayout: OrganizerPayout = {
      id: `org-pay-${Date.now()}`,
      eventId: payload.eventId,
      eventTitle: targetEvent?.title || 'Événement KolaPass',
      organizerName: targetEvent?.organizerName || 'Organisateur Officiel',
      organizerPhone: targetEvent?.organizerPhone || '',
      amountUSD: payload.amountUSD,
      paymentRail: payload.paymentRail,
      destinationAccount: payload.destinationAccount,
      status: 'completed',
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    setOrganizerPayouts((prev) => [newPayout, ...prev]);
  };

  const handleRunBimétierTest = () => {
    setActiveTab('pos');
    const pharmaProd =
      products.find(
        (p) => p.sector === 'pharmacy' && p.requiresPrescription && p.stock > 0
      ) || products.find((p) => p.sector === 'pharmacy' && p.stock > 0);

    const salonProd =
      products.find(
        (p) => p.sector === 'salon' && p.salonTier === 'Haut de Gamme' && p.stock > 0
      ) || products.find((p) => p.sector === 'salon' && p.stock > 0);

    const testCart: CartItem[] = [];
    if (pharmaProd) {
      testCart.push({
        product: pharmaProd,
        quantity: 1,
        discountPercent: 0,
        prescriptionNumber: 'ORD-2026-9041',
        prescribingDoctor: 'Dr. Kasongo (Clinique Centrale)',
      });
      setPrescriptionRef('ORD-2026-9041');
      setPrescribingDoctor('Dr. Kasongo (Clinique Centrale)');
    }
    if (salonProd) {
      testCart.push({
        product: salonProd,
        quantity: 1,
        discountPercent: 0,
        assignedStylist: settings.availableStylists?.[0] || 'Jean-Marc (VIP)',
        salonTier: salonProd.salonTier,
      });
      setAssignedStylist(settings.availableStylists?.[0] || 'Jean-Marc (VIP)');
      setTipAmountUSD(5);
    }
    if (testCart.length > 0) {
      setCart(testCart);
      if (customers.length > 0) {
        setSelectedCustomerId(customers[0].id);
      }
      setIsPaymentModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-sky-50 via-sky-100/30 to-blue-50/50 text-slate-900">
      {/* Strictly Compliant 3-Zone Top Bar Contract with Sky Blue & Crimson borders */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-sky-300 bg-white/95 backdrop-blur-xs px-6 py-3.5 shadow-2xs">
        {/* Zone 1: Single brand wordmark with KolaPass identity */}
        <div className="flex items-center gap-2.5">
          <a
            href="#ticketing"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('ticketing');
              setTicketingSubTab('events');
            }}
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-600 bg-rose-700 text-white font-mono text-sm shadow-xs font-bold">
              KP
            </span>
            <span className="text-slate-950 font-black">KolaPass</span>
          </a>
          <span className="hidden sm:inline-block rounded-md border-2 border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">
            Billetterie & Portique QR
          </span>
        </div>

        {/* Zone 2: Navbar sous forme de boutons grise */}
        <nav className="hidden lg:flex items-center gap-1.5 rounded-2xl border-2 border-slate-300 bg-slate-100 p-1.5 shadow-2xs">
          {[
            { id: 'events', label: 'Événements & Vente' },
            { id: 'scanner', label: 'Portique Caméra', highlight: true },
            { id: 'passes', label: 'Billets & Pass', count: ticketPasses.length },
            { id: 'logs', label: 'Journal des Scans', count: accessLogs.length },
            { id: 'organizers', label: 'Reversements' },
            { id: 'monetization', label: 'Rentabilité (7%)' },
          ].map((item) => {
            const isActive = activeTab === 'ticketing' && ticketingSubTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab('ticketing');
                  setTicketingSubTab(item.id as SubTab);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border shadow-2xs ${
                  isActive
                    ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                    : 'border-slate-300/80 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-200/80 hover:text-slate-950'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.count === 'number' && (
                  <span
                    className={`rounded-md px-1.5 py-0.2 font-mono text-[10px] ${
                      isActive
                        ? 'bg-slate-700 text-slate-100 border border-slate-600'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {item.highlight && !isActive && (
                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Currency selector & Quick Scanner Launch & Role Badge */}
        <div className="flex items-center gap-2.5">
          <select
            aria-label="Choisir la devise d'affichage"
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
            className="rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:border-slate-700 focus:outline-none"
          >
            <option value="USD">USD ($)</option>
            <option value="CDF">CDF (FC)</option>
            <option value="XOF">XOF (FCFA)</option>
            <option value="EUR">EUR (€)</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ticketing');
              setTicketingSubTab('scanner');
            }}
            className="rounded-lg border-2 border-slate-800 bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition-colors whitespace-nowrap shadow-xs"
          >
            Scanner Caméra
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar for KolaPass sous forme de boutons grise */}
      <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto border-b-2 border-slate-300 bg-slate-100 p-2 text-xs">
        {[
          { id: 'events', label: 'Événements' },
          { id: 'scanner', label: 'Scanner QR' },
          { id: 'passes', label: `Billets (${ticketPasses.length})` },
          { id: 'logs', label: `Audit (${accessLogs.length})` },
          { id: 'organizers', label: 'Reversements' },
          { id: 'monetization', label: 'Finances' },
        ].map((item) => {
          const isActive = activeTab === 'ticketing' && ticketingSubTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab('ticketing');
                setTicketingSubTab(item.id as SubTab);
              }}
              className={`rounded-xl px-3 py-1.5 font-bold whitespace-nowrap border text-xs shadow-2xs transition-all ${
                isActive
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Sub-header context bar dedicated to Billetterie & Portique */}
      <div className="border-b border-sky-200 bg-sky-100/60 px-6 py-2">
        <div className="mx-auto max-w-[1400px] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-bold text-slate-900">
              KolaPass Pro : Billetterie Événementielle & Portique Sécurisé QR
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700 font-bold">
              1 USD = {settings.rates.CDF.toLocaleString('fr-FR')} FC ={' '}
              {settings.rates.XOF.toLocaleString('fr-FR')} FCFA
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-800 font-bold">Commission : 7,0%</span>
          </div>

          <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px] font-semibold">
            <span>{events.length} événement(s)</span>
            <span>·</span>
            <span>{ticketPasses.length} pass émis</span>
            <span>·</span>
            <span>{accessLogs.length} scan(s)</span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-6">
        {activeTab === 'ticketing' && (
          <TicketingProjectView
            events={events}
            passes={ticketPasses}
            accessLogs={accessLogs}
            organizerPayouts={organizerPayouts}
            displayCurrency={displayCurrency}
            settings={settings}
            onCreateEvent={handleCreateEvent}
            onPurchaseTicketPasses={handlePurchaseTicketPass}
            onScanTicketPass={handleScanTicketPass}
            onRequestOrganizerPayout={handleRequestOrganizerPayout}
            onClearAccessLogs={() => setAccessLogs([])}
            activeSubTab={ticketingSubTab}
            onSubTabChange={setTicketingSubTab}
            currentUserSession={userSession}
            onUpdateUserSession={setUserSession}
            onBlacklistPass={handleBlacklistTicketPass}
            onReactivatePass={handleReactivateTicketPass}
            onSyncOfflineScans={handleSyncOfflineScans}
          />
        )}

        {activeTab === 'fintech' && (
          <FintechProjectView
            paymentLinks={paymentLinks}
            invoices={invoices}
            transactions={fintechTransactions}
            payouts={payouts}
            displayCurrency={displayCurrency}
            settings={settings}
            onCreatePaymentLink={handleCreatePaymentLink}
            onCreateInvoice={handleCreateInvoice}
            onProcessCheckoutPayment={handleProcessCheckoutPayment}
            onRequestPayout={handleRequestPayout}
          />
        )}

        {activeTab === 'pos' && (
          <PosTerminalView
            products={products}
            customers={customers}
            cart={cart}
            selectedCustomerId={selectedCustomerId}
            globalDiscountPercent={globalDiscountPercent}
            displayCurrency={displayCurrency}
            settings={settings}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onSelectCustomer={setSelectedCustomerId}
            onSetGlobalDiscount={setGlobalDiscountPercent}
            onQuickAddCustomer={handleQuickAddCustomer}
            onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
            prescriptionRef={prescriptionRef}
            prescribingDoctor={prescribingDoctor}
            onChangePrescription={(ref, doc) => {
              setPrescriptionRef(ref);
              setPrescribingDoctor(doc);
            }}
            assignedStylist={assignedStylist}
            onChangeStylist={setAssignedStylist}
            tipAmountUSD={tipAmountUSD}
            onChangeTip={setTipAmountUSD}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            stockMovements={stockMovements}
            barcodeBatches={barcodeBatches}
            displayCurrency={displayCurrency}
            settings={settings}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onAdjustStock={handleAdjustStock}
            onGenerateBarcodeBatch={handleGenerateBarcodeBatch}
          />
        )}

        {activeTab === 'sales' && (
          <SalesReportView
            sales={sales}
            displayCurrency={displayCurrency}
            settings={settings}
            onInspectReceipt={(sale) => setInspectedSale(sale)}
            onRefundSale={handleRefundSale}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            displayCurrency={displayCurrency}
            settings={settings}
            onAddCustomer={(custData) => {
              setCustomers((prev) => [
                {
                  ...custData,
                  id: `cust-${Date.now()}`,
                  lastVisit: new Date().toISOString(),
                },
                ...prev,
              ]);
            }}
            onRecordDebtPayment={handleRecordDebtPayment}
          />
        )}

        {activeTab === 'saas' && (
          <SaaSBusinessView
            tenants={tenants}
            settings={settings}
            onAddTenant={handleAddTenant}
            onUpdateTenantStatus={handleUpdateTenantStatus}
            onUpdateSettings={setSettings}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto max-w-[1400px] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            KolaPass Pro — Billetterie Événementielle Numérique & Portique Sécurisé QR Code · Paiements Mobile Money (M-Pesa, Orange Money, Airtel Money, Wave) & Cartes Bancaires · Commission 7,0%
          </div>
          <div className="flex items-center gap-4">
            {activeTab !== 'ticketing' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ticketing');
                  setTicketingSubTab('events');
                }}
                className="font-semibold text-emerald-700 hover:text-emerald-900 underline"
              >
                ← Retour à la Billetterie KolaPass
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="text-slate-500 hover:text-slate-900 underline"
            >
              Réinitialiser les données de démonstration
            </button>
          </div>
        </div>
      </footer>

      {/* Payment Modal (Project 1 POS) */}
      {isPaymentModalOpen && (
        <PaymentModal
          totalUSD={totalUSD}
          displayCurrency={displayCurrency}
          settings={settings}
          selectedCustomer={selectedCustomer}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirmPayment={handleConfirmPayment}
        />
      )}

      {/* Thermal Receipt Modal (Project 1 POS) */}
      {inspectedSale && (
        <ReceiptModal
          sale={inspectedSale}
          settings={settings}
          displayCurrency={displayCurrency}
          onClose={() => setInspectedSale(null)}
        />
      )}
    </div>
  );
}
