export type ProductStatus = 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN';
/** UNIT: sold by the piece · WEIGHT: sold by the kilogram (price is per kg). */
export type SaleMode = 'UNIT' | 'WEIGHT';

export interface ProductImage {
  id: string;
  url: string;
}

export type ProductLocale = 'en' | 'pt' | 'es';
export interface ProductTranslation {
  name?: string;
  description?: string;
  category?: string;
}
export type ProductTranslations = Partial<Record<ProductLocale, ProductTranslation>>;

export interface Product {
  id: string;
  slug: string;
  /** public API with ?locale=: already in that language (falls back to the original); admin API: the original */
  name: string;
  description: string;
  priceCents: number | null;
  category: string;
  /** public API with ?locale=: the category as typed (what ?category= filters by) */
  categoryKey?: string;
  /** admin API only */
  translations?: ProductTranslations;
  weight: string | null;
  dimensions: string | null;
  origin: string | null;
  featured: boolean;
  status: ProductStatus;
  saleMode: SaleMode;
  inStock: boolean;
  /** admin API only */
  stockQuantity?: number;
  stockGrams?: number;
  costCents?: number | null;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

/** USD→BRL rate used to show prices in reais on the Portuguese site (see GET /fx/usd-brl). */
export interface FxInfo {
  /** reais per 1 US dollar */
  rate: number;
  /** ISO time the source set the quote */
  asOf: string;
  source: 'BCB_PTAX' | 'AWESOMEAPI';
  stale: boolean;
}

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryCount {
  /** the category as typed (what ?category= filters by) */
  name: string;
  /** how to show it in the requested language */
  label: string;
  count: number;
}

export interface Stats {
  total: number;
  byStatus: Record<ProductStatus, number>;
  featured: number;
  images: number;
  availableValueCents: number;
  categories: CategoryCount[];
  recent: Product[];
  lowStock: { id: string; slug: string; name: string; stockQuantity: number }[];
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface AuditLogList {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TeamMember {
  id: string;
  username: string;
  createdAt: string;
  mustChangePassword: boolean;
  createdBy: string | null;
  isYou: boolean;
}

export type SaleStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Address {
  recipient?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface SaleItem {
  id: string;
  productId: string | null;
  productName: string;
  category: string;
  mode: SaleMode;
  /** pieces (UNIT) or grams (WEIGHT) */
  quantity: number;
  /** per piece or per kilogram */
  unitPriceCents: number;
  costCents: number | null;
  totalCents: number;
  cover: string | null;
}

export interface Sale {
  id: string;
  number: number;
  soldAt: string;
  status: SaleStatus;
  customerId: string | null;
  customerName: string;
  shipTo: Address | null;
  shippingMethod: string | null;
  shippingCostCents: number;
  trackingCode: string | null;
  /** money is always US dollars; these record what was actually received when the customer paid in reais */
  paidCurrency: 'USD' | 'BRL';
  paidAmountCents: number | null;
  fxRate: number | null;
  paymentMethod: string;
  discountCents: number;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  clickRef: string | null;
  createdAt: string;
  items: SaleItem[];
  photos: { id: string; url: string }[];
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  orders?: number;
  spentCents?: number;
  lastPurchaseAt?: string | null;
  sales?: {
    id: string;
    number: number;
    soldAt: string;
    status: SaleStatus;
    totalCents: number;
    shippingMethod: string | null;
    trackingCode: string | null;
  /** money is always US dollars; these record what was actually received when the customer paid in reais */
  paidCurrency: 'USD' | 'BRL';
  paidAmountCents: number | null;
  fxRate: number | null;
    items: { productName: string; mode: SaleMode; quantity: number }[];
  }[];
}

export interface FinanceSummary {
  range: string;
  perDay: boolean;
  revenueCents: number;
  shippingCents: number;
  orders: number;
  averageTicketCents: number;
  units: number;
  grams: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
  costCoveragePct: number;
  previous: { revenueCents: number; orders: number } | null;
  series: { date: string; revenueCents: number; orders: number }[];
  byCategory: { name: string; revenueCents: number }[];
  topProducts: { name: string; revenueCents: number; orders: number; units: number; grams: number }[];
  byCountry: { country: string; orders: number; revenueCents: number }[];
  byPayment: { method: string; orders: number; revenueCents: number }[];
  funnel: { clicks: number; confirmed: number; sales: number; salesFromClicks: number };
}

export interface ClicksSummary {
  days: number;
  total: number;
  confirmed: number;
  bySource: { source: string; count: number }[];
  topProducts: { slug: string; name: string; count: number }[];
  daily: { date: string; count: number; confirmed: number }[];
}
