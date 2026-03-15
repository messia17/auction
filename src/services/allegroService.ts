import { GoogleGenAI } from "@google/genai";
import { AllegroItem } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export const CATEGORIES: Category[] = [
  { id: '1', name: 'Antyki i Kolekcje', parentId: null },
  { id: '1.1', name: 'Kolekcje', parentId: '1' },
  { id: '1.1.1', name: 'Militaria', parentId: '1.1' },
  { id: '1.1.1.1', name: 'Szable i miecze', parentId: '1.1.1' },
  { id: '1.1.1.2', name: 'Noże i kordziki', parentId: '1.1.1' },
  { id: '1.1.1.3', name: 'Hełmy', parentId: '1.1.1' },
  { id: '1.1.1.4', name: 'Bagnety', parentId: '1.1.1' },
  { id: '2', name: 'Dom i Ogród', parentId: null },
  { id: '2.1', name: 'Wyposażenie', parentId: '2' },
  { id: '2.1.1', name: 'Oświetlenie', parentId: '2.1' },
  { id: '3', name: 'Elektronika', parentId: null },
  { id: '3.1', name: 'Telefony', parentId: '3' },
  { id: '3.2', name: 'Komputery', parentId: '3' },
  { id: '4', name: 'Moda', parentId: null },
  { id: '4.1', name: 'Obuwie', parentId: '4' },
  { id: '4.2', name: 'Odzież', parentId: '4' },
  { id: '5', name: 'Motoryzacja', parentId: null },
  { id: '5.1', name: 'Części samochodowe', parentId: '5' },
  { id: '6', name: 'Sport i Turystyka', parentId: null },
];

const MOCK_ITEMS: AllegroItem[] = [
  {
    id: '1',
    title: 'Szabla Husarska XVII wiek - Replika bojowa',
    seller: 'Antyki_Kolekcje',
    price: 1250.00,
    currency: 'PLN',
    category: '1.1.1.1',
    thumbnail: 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/szabla-husarska-xvii-wiek-replika-bojowa-1000000001'
  },
  {
    id: '2',
    title: 'Miecz Rzymski Gladius - Stal wysokowęglowa',
    seller: 'Militaria_Expert',
    price: 450.00,
    currency: 'PLN',
    category: '1.1.1.1',
    thumbnail: 'https://images.unsplash.com/photo-1589703510318-22095c500463?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/miecz-rzymski-gladius-stal-wysokoweglowa-1000000002'
  },
  {
    id: '3',
    title: 'Kordzik Wojsk Lądowych wz. 1954 - Oryginał',
    seller: 'History_Buff',
    price: 890.00,
    currency: 'PLN',
    category: '1.1.1.2',
    thumbnail: 'https://images.unsplash.com/photo-1614035030394-b6e5b01e0737?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/kordzik-wojsk-ladowych-wz-1954-oryginal-1000000003'
  },
  {
    id: '4',
    title: 'Hełm wz. 31 - Polski, stan strychowy',
    seller: 'Antyki_Kolekcje',
    price: 1500.00,
    currency: 'PLN',
    category: '1.1.1.3',
    thumbnail: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/helm-wz-31-polski-stan-strychowy-1000000004'
  },
  {
    id: '5',
    title: 'Bagnet wz. 24 - Polski, przedwojenny, Radom',
    seller: 'Militaria_Expert',
    price: 600.00,
    currency: 'PLN',
    category: '1.1.1.4',
    thumbnail: 'https://images.unsplash.com/photo-1590096598321-a4268829670c?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/bagnet-wz-24-polski-przedwojenny-radom-1000000005'
  },
  {
    id: '6',
    title: 'Lampa Naftowa XIX wiek - Mosiądz',
    seller: 'Antyki_Kolekcje',
    price: 320.00,
    currency: 'PLN',
    category: '2.1.1',
    thumbnail: 'https://images.unsplash.com/photo-1517467397445-47a4a7c2d4aa?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/lampa-naftowa-xix-wiek-mosiadz-1000000006'
  },
  {
    id: '7',
    title: 'Zegar Kominkowy - Styl Ludwik XV',
    seller: 'Old_Time_Store',
    price: 2100.00,
    currency: 'PLN',
    category: '1',
    thumbnail: 'https://images.unsplash.com/photo-1509130298739-651801c76e96?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/zegar-kominkowy-styl-ludwik-xv-1000000007'
  },
  {
    id: '8',
    title: 'iPhone 13 128GB - Stan Idealny, Gwarancja',
    seller: 'Mobile_Store_PL',
    price: 2850.00,
    currency: 'PLN',
    category: '3.1',
    thumbnail: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/iphone-13-128gb-stan-idealny-1000000008'
  },
  {
    id: '9',
    title: 'Laptop Gamingowy ASUS ROG - RTX 3060, 16GB RAM',
    seller: 'Tech_World',
    price: 4200.00,
    currency: 'PLN',
    category: '3.2',
    thumbnail: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/laptop-gamingowy-asus-rog-1000000009'
  },
  {
    id: '10',
    title: 'Buty Sportowe Nike Air Max - Nowe, Oryginalne',
    seller: 'Sport_Outlet',
    price: 450.00,
    currency: 'PLN',
    category: '4.1',
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/buty-sportowe-nike-air-max-1000000010'
  },
  {
    id: '11',
    title: 'Bluza z kapturem Adidas - Czarna, Rozmiar L',
    seller: 'Fashion_Hub',
    price: 180.00,
    currency: 'PLN',
    category: '4.2',
    thumbnail: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/bluza-z-kapturem-adidas-1000000011'
  },
  {
    id: '12',
    title: 'Tarcze Hamulcowe Brembo - Przód, BMW E90',
    seller: 'Auto_Parts_PL',
    price: 350.00,
    currency: 'PLN',
    category: '5.1',
    thumbnail: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/tarcze-hamulcowe-brembo-1000000012'
  },
  {
    id: '13',
    title: 'Rower Górski MTB 29 cali - Shimano Deore',
    seller: 'Bike_World',
    price: 3200.00,
    currency: 'PLN',
    category: '6',
    thumbnail: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=200&h=200',
    url: 'https://allegro.pl/oferta/rower-gorski-mtb-29-1000000013'
  }
];

export const searchWithAI = async (query: string, filters: any): Promise<AllegroItem[]> => {
  try {
    const categoryName = filters.categoryId ? CATEGORIES.find(c => c.id === filters.categoryId)?.name : null;
    const searchTarget = query ? `for: "${query}"` : (categoryName ? `in category "${categoryName}"` : "popular items");
    
    const prompt = `Find current listings on allegro.pl ${searchTarget}. 
    ${categoryName ? `Category: ${categoryName}` : ''}
    Filters: Price from ${filters.minPrice || 0} to ${filters.maxPrice || 'unlimited'} PLN.
    Return a list of products with their titles, prices, and direct URLs.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    // Parse the AI response to extract items
    // This is a simplified parser - in a real app, we'd use a more robust regex or structured output
    const items: AllegroItem[] = [];
    
    if (chunks) {
      chunks.forEach((chunk, index) => {
        if (chunk.web) {
          const url = chunk.web.uri;
          if (url.includes('allegro.pl/oferta/')) {
            items.push({
              id: `ai-${index}`,
              title: chunk.web.title || query,
              seller: 'Allegro Seller',
              price: 0, // AI might not always give precise price in metadata
              currency: 'PLN',
              category: filters.categoryId || 'unknown',
              thumbnail: 'https://picsum.photos/seed/allegro/200/200',
              url: url
            });
          }
        }
      });
    }

    // If no chunks, try to parse from text
    if (items.length === 0) {
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('http') && line.includes('allegro.pl')) {
          const urlMatch = line.match(/https?:\/\/allegro\.pl\/oferta\/[^\s)]+/);
          if (urlMatch) {
            items.push({
              id: `ai-text-${index}`,
              title: line.split('http')[0].replace(/[*#-]/g, '').trim() || query,
              seller: 'Allegro Seller',
              price: 0,
              currency: 'PLN',
              category: filters.categoryId || 'unknown',
              thumbnail: 'https://picsum.photos/seed/allegro/200/200',
              url: urlMatch[0]
            });
          }
        }
      });
    }

    return items;
  } catch (error) {
    console.error('AI Search failed:', error);
    return [];
  }
};

export const getCategoryPath = (categoryId: string): Category[] => {
  const path: Category[] = [];
  let current = CATEGORIES.find(c => c.id === categoryId);
  while (current) {
    path.unshift(current);
    current = CATEGORIES.find(c => c.id === current?.parentId);
  }
  return path;
};

export const searchAllegro = async (query: string, filters: any, proxyConfig?: any): Promise<AllegroItem[]> => {
  try {
    const params = new URLSearchParams();
    if (query) params.append('phrase', query);
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.minPrice) params.append('minPrice', filters.minPrice.toString());
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());

    const headers: any = {};
    if (proxyConfig && proxyConfig.host) {
      headers['x-proxy-protocol'] = proxyConfig.protocol;
      headers['x-proxy-host'] = proxyConfig.host;
      headers['x-proxy-port'] = proxyConfig.port;
      headers['x-proxy-user'] = proxyConfig.username;
      headers['x-proxy-pass'] = proxyConfig.password;
    }

    const response = await fetch(`/api/search?${params.toString()}`, { headers });
    
    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 403 && errorData.error === 'captcha_required') {
        throw new Error(JSON.stringify(errorData));
      }
      throw new Error(errorData.error || 'Search failed');
    }

    let items: AllegroItem[] = await response.json();
    console.log(`[Allegro] Received ${items.length} items from API/Scraper`);

    // Apply client-side filters that API might not support directly (like exclude keywords/sellers)
    return items.filter(item => {
      const matchesInclude = !filters.includeKeywords || filters.includeKeywords.length === 0 || 
                             filters.includeKeywords.some((kw: string) => item.title.toLowerCase().includes(kw.toLowerCase()));
      
      const matchesExclude = !filters.excludeKeywords || filters.excludeKeywords.length === 0 || 
                             !filters.excludeKeywords.some((kw: string) => item.title.toLowerCase().includes(kw.toLowerCase()));

      const matchesSeller = !filters.excludeSellers || filters.excludeSellers.length === 0 ||
                            !filters.excludeSellers.some((s: string) => item.seller.toLowerCase() === s.toLowerCase());

      return matchesInclude && matchesExclude && matchesSeller;
    });
  } catch (error) {
    console.warn('Allegro search failed (API & Scraper), falling back to internal mock data. Reason:', error instanceof Error ? error.message : error);
    
    // Fallback to mock data for demonstration if API is not configured
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_ITEMS.filter(item => {
      const matchesQuery = !query || 
                           item.title.toLowerCase().includes(query.toLowerCase()) || 
                           item.seller.toLowerCase().includes(query.toLowerCase());
      
      const matchesCategory = !filters.categoryId || item.category.startsWith(filters.categoryId);

      const matchesPrice = (filters.minPrice === undefined || item.price >= filters.minPrice) &&
                           (filters.maxPrice === undefined || item.price <= filters.maxPrice);
      
      const matchesInclude = !filters.includeKeywords || filters.includeKeywords.length === 0 || 
                             filters.includeKeywords.some((kw: string) => item.title.toLowerCase().includes(kw.toLowerCase()));
      
      const matchesExclude = !filters.excludeKeywords || filters.excludeKeywords.length === 0 || 
                             !filters.excludeKeywords.some((kw: string) => item.title.toLowerCase().includes(kw.toLowerCase()));

      const matchesSeller = !filters.excludeSellers || filters.excludeSellers.length === 0 ||
                            !filters.excludeSellers.some((s: string) => item.seller.toLowerCase() === s.toLowerCase());

      return matchesQuery && matchesCategory && matchesPrice && matchesInclude && matchesExclude && matchesSeller;
    });
  }
};


