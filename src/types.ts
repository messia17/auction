export interface ViewedItem {
  id?: string;
  itemId: string;
  title: string;
  seller: string;
  price: number;
  currency: string;
  keywords: string[];
  viewedAt: string;
  userId: string;
}

export interface SavedSearch {
  id?: string;
  name: string;
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  includeKeywords: string[];
  excludeKeywords: string[];
  excludeSellers: string[];
  userId: string;
  createdAt: string;
}

export interface AllegroItem {
  id: string;
  title: string;
  seller: string;
  price: number;
  currency: string;
  category: string;
  thumbnail: string;
  url: string;
}
