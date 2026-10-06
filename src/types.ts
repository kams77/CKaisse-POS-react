export type CurrencyCode = 'USD' | 'CDF' | 'XOF' | 'EUR';

export type BusinessSector = 'pharmacy' | 'salon';

export type SalonTier = 'Simple' | 'Haut de Gamme';

export type PharmacyCategory =
  | 'Antibiotiques & Anti-infectieux'
  | 'Antalgiques & Anti-inflammatoires'
  | 'Vitamines & Compléments DCI'
  | 'Dermatologie & Soins Plaies'
  | 'Matériel Médical & Injectables'
  | 'Pédiatrie & Sirop';

export type SalonCategory =
  | 'Coiffure & Coupe Homme/Femme'
  | 'Barbier & Soins Barbe VIP'
  | 'Tresses, Nattes & Extensions'
  | 'Coloration & Mèches Haute Couture'
  | 'Soins Kératine, Botox & Lissage'
  | 'Vente Produits Capillaires & Sérums';

export type ProductCategory = PharmacyCategory | SalonCategory;

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  sector: BusinessSector;
  costPriceUSD: number;
  salePriceUSD: number;
  stock: number;
  minStockAlert: number;
  unit: string;
  supplier: string;
  updatedAt: string;
  // Spécifique Pharmacie & Dépôt pharmaceutique
  activeMolecule?: string; // DCI (Principe actif)
  dosage?: string; // ex: 500mg, Sirop 125ml
  batchNumber?: string; // N° de Lot
  expiryDate?: string; // Date de péremption YYYY-MM-DD
  requiresPrescription?: boolean; // Ordonnance médicale obligatoire
  // Spécifique Salon de Coiffure (Simple & Haut de Gamme)
  isService?: boolean; // Vrai si prestation coiffure, faux si produit de soin
  salonTier?: SalonTier; // Simple vs Haut de Gamme VIP
  durationMinutes?: number; // Durée de la prestation
  defaultStylist?: string; // Coiffeur / Styliste référent
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
  prescriptionNumber?: string;
  prescribingDoctor?: string;
  assignedStylist?: string;
  salonTier?: SalonTier;
}

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit';

export type MobileMoneyOperator =
  | 'M-Pesa'
  | 'Orange Money'
  | 'Airtel Money'
  | 'Wave'
  | 'MTN MoMo';

export interface SaleItemSnapshot {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceUSD: number;
  costPriceUSD: number;
  discountPercent: number;
  lineTotalUSD: number;
  dosage?: string;
  batchNumber?: string;
  expiryDate?: string;
  requiresPrescription?: boolean;
  assignedStylist?: string;
  salonTier?: SalonTier;
  isService?: boolean;
}

export interface SaleRecord {
  id: string;
  receiptNumber: string;
  createdAt: string;
  cashierName: string;
  sector: BusinessSector;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  prescriptionRef?: string;
  prescribingDoctor?: string;
  assignedStylist?: string;
  tipAmountUSD?: number;
  items: SaleItemSnapshot[];
  subtotalUSD: number;
  discountUSD: number;
  taxUSD: number;
  totalUSD: number;
  profitUSD: number;
  currencyUsed: CurrencyCode;
  exchangeRateUsed: number;
  paymentMethod: PaymentMethod;
  mobileOperator?: MobileMoneyOperator;
  mobilePhone?: string;
  transactionRef?: string;
  amountTenderedUSD: number;
  changeDueUSD: number;
  status: 'completed' | 'refunded';
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalPurchasesUSD: number;
  creditBalanceUSD: number;
  lastVisit: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'in' | 'sale' | 'adjustment' | 'refund';
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  note: string;
  createdAt: string;
}

export interface BarcodeBatchRecord {
  id: string;
  batchCode: string;
  startBarcode: string;
  endBarcode: string;
  quantity: number;
  codes: string[];
  label: string;
  authorizedBy: string;
  createdAt: string;
}

export interface SaaSTenant {
  id: string;
  storeName: string;
  ownerName: string;
  phone: string;
  city: string;
  businessType:
    | 'Pharmacie & Dépôt Pharmaceutique'
    | 'Salon de Coiffure Haut de Gamme'
    | 'Salon de Coiffure & Barbier Simple';
  plan: 'Starter' | 'Business' | 'Enterprise';
  monthlyFeeUSD: number;
  billingStatus: 'Actif' | 'Essai gratuit' | 'Retard de paiement';
  terminalsCount: number;
  joinedAt: string;
  nextBillingDate: string;
  licenseKey: string;
}

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  taxId: string;
  cashierName: string;
  receiptFooter: string;
  defaultCurrency: CurrencyCode;
  taxRatePercent: number;
  adminPassword: string;
  rates: Record<CurrencyCode, number>;
  sector: BusinessSector;
  pharmacyLicenseNumber?: string;
  availableStylists: string[];
}

// ============================================================================
// PROJET 2 : KOLAPAY — LIENS DE PAIEMENT, FACTURATION & API FINTECH
// ============================================================================

export type FintechRail =
  | 'M-Pesa'
  | 'Orange Money'
  | 'Airtel Money'
  | 'Wave'
  | 'MTN MoMo'
  | 'Visa / Mastercard';

export interface PaymentLinkItem {
  id: string;
  shortCode: string;
  title: string;
  description: string;
  amountUSD: number;
  merchantName: string;
  clicksCount: number;
  salesCount: number;
  totalCollectedUSD: number;
  collectCustomerAddress: boolean;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  description: string;
  amountUSD: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  paidAt?: string;
  paymentRail?: FintechRail;
  createdAt: string;
}

export interface FintechTransaction {
  id: string;
  reference: string;
  sourceType: 'payment_link' | 'invoice' | 'api_web' | 'api_pos';
  sourceTitle: string;
  customerName: string;
  customerPhone: string;
  grossAmountUSD: number;
  platformFeeUSD: number;
  netMerchantUSD: number;
  paymentRail: FintechRail;
  status: 'succeeded' | 'pending' | 'failed';
  webhookStatus: '200 OK' | 'En attente';
  webhookSignature: string;
  createdAt: string;
}

export interface MerchantPayout {
  id: string;
  amountUSD: number;
  destination: string;
  status: 'completed' | 'processing';
  createdAt: string;
}

// ============================================================================
// PROJET 3 : KOLAPASS — BILLETTERIE EN LIGNE & CONTRÔLE D'ACCÈS QR CODE
// ============================================================================

export type EventCategory =
  | 'Concert & Festival'
  | 'Conférence & Business'
  | 'Formation & Masterclass'
  | 'Sport & Match'
  | 'Soirée & Gala';

export interface TicketTier {
  id: string;
  name: 'Standard' | 'VIP' | 'VVIP';
  priceUSD: number;
  capacity: number;
  sold: number;
}

export interface TicketingEvent {
  id: string;
  code: string;
  title: string;
  category: EventCategory;
  organizerName: string;
  organizerPhone: string;
  venue: string;
  city: string;
  eventDate: string;
  tiers: TicketTier[];
  commissionRatePercent: number;
  status: 'upcoming' | 'completed';
  createdAt: string;
}

export type UserRole = 'admin' | 'organizer' | 'agent';

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  token: string;
  twoFactorVerified: boolean;
  avatarUrl: string;
  assignedGate?: string;
  assignedEventId?: string;
}

export interface EventTicketPass {
  id: string;
  passCode: string; // e.g. EVT123-8F3K9X2Q
  qrSignature: string;
  jwtToken?: string;
  qrPayload?: string;
  avatarUrl?: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  tierName: 'Standard' | 'VIP' | 'VVIP';
  holderName: string;
  holderPhone: string;
  holderEmail?: string;
  pricePaidUSD: number;
  platformFeeUSD: number;
  netOrganizerUSD: number;
  paymentRail: FintechRail;
  transactionReference?: string;
  status: 'valid' | 'used' | 'blacklisted' | 'cancelled';
  blacklistReason?: string;
  blacklistedAt?: string;
  checkedInAt?: string;
  checkedInGate?: string;
  checkedInBy?: string;
  scanAttempts: number;
  purchasedAt: string;
  // Plage de billets (Lot organisateur)
  batchId?: string;
  batchNumber?: string;
  batchName?: string;
  rangeIndex?: number;
  rangeTotal?: number;
  isBatchTicket?: boolean;
  distributorName?: string;
}

export interface TicketBatchRange {
  id: string;
  batchNumber: string;
  name: string;
  eventId: string;
  eventTitle: string;
  tierName: 'Standard' | 'VIP' | 'VVIP';
  unitPriceUSD: number;
  startNumber: number;
  endNumber: number;
  quantity: number;
  prefix: string;
  generatedBy: string;
  distributorName?: string;
  distributorPhone?: string;
  totalValueUSD: number;
  status: 'active' | 'archived' | 'exhausted';
  notes?: string;
  generatedAt: string;
  passIds: string[];
  scannedCount: number;
}

export interface AccessLogEntry {
  id: string;
  timestamp: string;
  passCode: string;
  holderName: string;
  eventTitle: string;
  tierName: string;
  gate: string;
  scannedBy: string;
  result: 'granted' | 'duplicate_denied' | 'invalid_unknown' | 'blacklisted_denied';
  notes?: string;
  offlineSynced?: boolean;
}

export interface OfflineScanItem {
  id: string;
  timestamp: string;
  passCode: string;
  gate: string;
  scannedBy: string;
  scannedAtOffline: string;
  outcome: 'valid_entry' | 'fraud_duplicate' | 'not_found' | 'blacklisted';
}

export interface NotificationRecord {
  id: string;
  recipientPhone: string;
  recipientEmail?: string;
  recipientName: string;
  passCode: string;
  eventTitle: string;
  channel: 'whatsapp' | 'email' | 'sms';
  status: 'sent' | 'delivered';
  messageBody: string;
  sentAt: string;
}

export interface OrganizerPayout {
  id: string;
  eventId: string;
  eventTitle: string;
  organizerName: string;
  organizerPhone: string;
  amountUSD: number;
  paymentRail: FintechRail;
  destinationAccount: string;
  status: 'pending' | 'completed';
  requestedAt: string;
  completedAt?: string;
}
