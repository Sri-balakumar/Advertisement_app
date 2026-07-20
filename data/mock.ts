/**
 * Mock content for 369 Advertisement.
 * Later this is replaced by a live feed from the Odoo `app_banner` module
 * (the /b/<code> banners), but the shapes below mirror that data.
 */

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  colors: [string, string];
  productId: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string; // Ionicons name
  colors: [string, string];
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  colors: [string, string];
  tagline: string;
  description: string;
  highlights: string[];
};

export const BANNERS: Banner[] = [
  {
    id: 'b1',
    title: 'Mega Electronics Sale',
    subtitle: 'Up to 60% off on top gadgets',
    badge: 'HOT',
    colors: ['#4f46e5', '#7c3aed'],
    productId: 'p1',
  },
  {
    id: 'b2',
    title: 'Fashion Fiesta',
    subtitle: 'Trending styles, fresh drops',
    badge: 'NEW',
    colors: ['#f43f5e', '#f59e0b'],
    productId: 'p3',
  },
  {
    id: 'b3',
    title: 'Grocery Bonanza',
    subtitle: 'Daily essentials, big savings',
    badge: 'SAVE',
    colors: ['#06b6d4', '#3b82f6'],
    productId: 'p5',
  },
  {
    id: 'b4',
    title: 'Beauty & Glow',
    subtitle: 'Self-care picks under ₹499',
    badge: 'DEAL',
    colors: ['#8b5cf6', '#ec4899'],
    productId: 'p6',
  },
];

export const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Electronics', icon: 'phone-portrait', colors: ['#4f46e5', '#7c3aed'] },
  { id: 'c2', name: 'Fashion', icon: 'shirt', colors: ['#f43f5e', '#fb7185'] },
  { id: 'c3', name: 'Grocery', icon: 'cart', colors: ['#06b6d4', '#3b82f6'] },
  { id: 'c4', name: 'Food', icon: 'fast-food', colors: ['#f59e0b', '#ef4444'] },
  { id: 'c5', name: 'Beauty', icon: 'sparkles', colors: ['#8b5cf6', '#ec4899'] },
  { id: 'c6', name: 'Travel', icon: 'airplane', colors: ['#10b981', '#06b6d4'] },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'AuroraBuds Pro',
    brand: 'SonicWave',
    category: 'Electronics',
    price: 2499,
    mrp: 5999,
    rating: 4.6,
    ratingCount: 1284,
    colors: ['#4f46e5', '#7c3aed'],
    tagline: 'Wireless earbuds with ANC',
    description:
      'Immersive sound with adaptive noise cancellation, 36-hour battery life and a feather-light fit for all-day comfort.',
    highlights: ['Active Noise Cancel', '36h battery', 'IPX5 water resistant', 'Fast pair'],
  },
  {
    id: 'p2',
    name: 'Nimbus Smart Watch',
    brand: 'Chrona',
    category: 'Electronics',
    price: 3299,
    mrp: 6499,
    rating: 4.4,
    ratingCount: 842,
    colors: ['#06b6d4', '#3b82f6'],
    tagline: 'AMOLED fitness companion',
    description:
      'Track workouts, sleep and heart rate on a crisp AMOLED display with a 7-day battery and 100+ sport modes.',
    highlights: ['AMOLED display', 'SpO2 + HR', '7-day battery', '100+ sports'],
  },
  {
    id: 'p3',
    name: 'Urban Flex Jacket',
    brand: 'Northline',
    category: 'Fashion',
    price: 1799,
    mrp: 3499,
    rating: 4.7,
    ratingCount: 512,
    colors: ['#f43f5e', '#f59e0b'],
    tagline: 'Water-resistant everyday jacket',
    description:
      'A versatile, water-resistant jacket with a tailored fit, breathable lining and zip pockets for the daily commute.',
    highlights: ['Water resistant', 'Breathable lining', 'Unisex fit', '4 colors'],
  },
  {
    id: 'p5',
    name: 'FreshPack Combo',
    brand: 'DailyMart',
    category: 'Grocery',
    price: 649,
    mrp: 999,
    rating: 4.3,
    ratingCount: 2210,
    colors: ['#06b6d4', '#3b82f6'],
    tagline: 'Weekly essentials bundle',
    description:
      'A curated bundle of daily staples delivered fresh — grains, oils and snacks at a bundled saver price.',
    highlights: ['12 items', 'Farm fresh', 'Free delivery', 'Best before 30d'],
  },
  {
    id: 'p6',
    name: 'GlowLuxe Serum',
    brand: 'Lumière',
    category: 'Beauty',
    price: 499,
    mrp: 899,
    rating: 4.5,
    ratingCount: 963,
    colors: ['#8b5cf6', '#ec4899'],
    tagline: 'Vitamin C radiance serum',
    description:
      'Brighten and even skin tone with a lightweight vitamin C serum enriched with hyaluronic acid.',
    highlights: ['Vitamin C 10%', 'Hyaluronic acid', 'Cruelty free', 'For all skin'],
  },
];

export const TRENDING: Product[] = [PRODUCTS[0], PRODUCTS[1], PRODUCTS[2], PRODUCTS[4]];

export function getProduct(id?: string): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}

export function discountPct(p: Product): number {
  if (!p.mrp || p.mrp <= p.price) return 0;
  return Math.round((1 - p.price / p.mrp) * 100);
}
