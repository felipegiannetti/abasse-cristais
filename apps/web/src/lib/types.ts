export type ProductStatus = 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN';

export interface ProductImage {
  id: string;
  url: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number | null;
  category: string;
  weight: string | null;
  dimensions: string | null;
  origin: string | null;
  featured: boolean;
  status: ProductStatus;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}
