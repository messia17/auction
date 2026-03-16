import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  History,
  BarChart3,
  Save,
  Eye,
  EyeOff,
  Filter,
  X,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  LogIn,
  Settings as SettingsIcon,
  Terminal
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { auth, db } from './firebase';
import { searchAllegro, searchWithAI, CATEGORIES, getCategoryPath, Category } from './services/allegroService';
import { ViewedItem, SavedSearch, AllegroItem } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg m-4">
          <h2 className="text-red-800 font-bold text-lg mb-2">Something went wrong</h2>
          <pre className="text-sm text-red-600 overflow-auto max-h-40">
            {this.state.error?.message || JSON.stringify(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [includeKeywords, setIncludeKeywords] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [excludeSellers, setExcludeSellers] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [isExclude, setIsExclude] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Results & Data State
  const [results, setResults] = useState<AllegroItem[]>([]);
  const [pendingViewTracking, setPendingViewTracking] = useState<AllegroItem[]>([]);
  const [viewedAtSearchStart, setViewedAtSearchStart] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [viewedItems, setViewedItems] = useState<ViewedItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [hideViewed, setHideViewed] = useState(false);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'newest' | 'relevance'>('relevance');

  // UI State
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'analytics' | 'saved' | 'settings'>('search');
  const [logs, setLogs] = useState<{ time: string, msg: string, type: 'info' | 'error' | 'success' }[]>([]);
  const [isLogsPanelOpen, setIsLogsPanelOpen] = useState(true);
  const [isScraping, setIsScraping] = useState(false);

  const isConfigured = !!(process.env.ALLEGRO_CLIENT_ID && process.env.ALLEGRO_CLIENT_SECRET);

  // Proxy State (Local for UI, but could be synced to Firestore)
  const [proxyConfig, setProxyConfig] = useState({
    protocol: 'http',
    host: 'eu.proxy.2captcha.com',
    port: '2334',
    username: 'ua968b7d956db05c7-zone-custom',
    password: 'ua968b7d956db05c7'
  });

  const [captchaConfig, setCaptchaConfig] = useState({
    apiKey: '',
    service: '2captcha' as '2captcha' | 'anticaptcha' | 'manual',
    autoSolve: false
  });

  const [captchaChallenge, setCaptchaChallenge] = useState<{
    id: string;
    imageUrl?: string;
    siteKey?: string;
    type: 'image' | 'recaptcha' | 'hcaptcha';
  } | null>(null);

  const [captchaSolution, setCaptchaSolution] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [isAllegroEnabled, setIsAllegroEnabled] = useState(true);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Connection Test
  useEffect(() => {
    if (isAuthReady) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      };
      testConnection();
    }
  }, [isAuthReady]);

  // Data Listeners
  useEffect(() => {
    if (!user) {
      setViewedItems([]);
      setSavedSearches([]);
      return;
    }

    const qViewed = query(
      collection(db, 'viewed_items'),
      where('userId', '==', user.uid),
      orderBy('viewedAt', 'desc')
    );

    const qSaved = query(
      collection(db, 'saved_searches'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubViewed = onSnapshot(qViewed, (snapshot) => {
      setViewedItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ViewedItem)));
    }, (err) => handleFirestoreError(err, 'list', 'viewed_items'));

    const unsubSaved = onSnapshot(qSaved, (snapshot) => {
      setSavedSearches(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SavedSearch)));
    }, (err) => handleFirestoreError(err, 'list', 'saved_searches'));

    return () => {
      unsubViewed();
      unsubSaved();
    };
  }, [user]);

  // Commit pending views when switching tabs
  useEffect(() => {
    if (activeTab !== 'search' && pendingViewTracking.length > 0 && user) {
      const commitViews = async () => {
        for (const item of pendingViewTracking) {
          await trackView(item);
        }
        setPendingViewTracking([]);
      };
      commitViews();
    }
  }, [activeTab, user]);

  // Trigger search on category change
  useEffect(() => {
    if (isAuthReady && user) {
      handleSearch();
    }
  }, [selectedCategoryId]);

  const handleFirestoreError = (error: any, op: string, path: string) => {
    const errInfo = {
      error: error?.message || String(error),
      operationType: op,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const logout = () => signOut(auth);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isAllegroEnabled) {
      addLog("Allegro service is currently disabled. Enable it in settings to search.", "info");
      return;
    }

    addLog(`Initiating search: "${searchQuery}"`, "info");

    // 1. Capture current viewed items to freeze the "viewed" status for this search
    const currentViewedIds = new Set(viewedItems.map(v => v.itemId));
    setViewedAtSearchStart(currentViewedIds);

    // 2. Track views for items from the PREVIOUS search before starting a new one
    if (pendingViewTracking.length > 0 && user) {
      addLog(`Committing ${pendingViewTracking.length} views from previous search...`, "info");
      for (const item of pendingViewTracking) {
        await trackView(item);
      }
      setPendingViewTracking([]);
    }

    setIsSearching(true);
    try {
      let items: AllegroItem[] = [];

      if (useAI) {
        addLog("Using AI Smart Search Mode...", "info");
        items = await searchWithAI(searchQuery, {
          minPrice: minPrice === '' ? undefined : minPrice,
          maxPrice: maxPrice === '' ? undefined : maxPrice,
          categoryId: selectedCategoryId
        });
      } else {
        addLog(isConfigured ? "Executing Allegro API Search..." : "Executing Direct Allegro Parsing...", "info");
        items = await searchAllegro(searchQuery, {
          categoryId: selectedCategoryId,
          minPrice: minPrice === '' ? undefined : minPrice,
          maxPrice: maxPrice === '' ? undefined : maxPrice,
          includeKeywords,
          excludeKeywords,
          excludeSellers
        }, proxyConfig);
      }

      if (items.length === 0 && !useAI) {
        addLog("No results from Allegro. Trying AI Smart Search as fallback...", "info");
        items = await searchWithAI(searchQuery, {
          minPrice: minPrice === '' ? undefined : minPrice,
          maxPrice: maxPrice === '' ? undefined : maxPrice,
          categoryId: selectedCategoryId
        });
      }

      addLog(`Search completed. Found ${items.length} items.`, "success");
      setResults(items);

      // Don't track immediately, queue them for next action
      setPendingViewTracking(items);
    } catch (error: any) {
      if (error.message && error.message.includes('captcha_required')) {
        try {
          const errData = JSON.parse(error.message);
          if (errData.error === 'captcha_required') {
            addLog("CAPTCHA challenge detected! Opening solver...", "error");
            setCaptchaChallenge(errData.challenge);
            return;
          }
        } catch (e) {
          // Fallback if parsing fails
          addLog("CAPTCHA required but challenge data is missing", "error");
        }
      }
      addLog(`Search failed: ${error?.message || String(error)}`, "error");
      console.error('Search failed', error);
    } finally {
      setIsSearching(false);
    }
  };

  const trackView = async (item: AllegroItem) => {
    if (!user) return;

    // Check if already viewed recently (to avoid duplicates in history)
    const alreadyViewed = viewedItems.find(v => v.itemId === item.id);
    if (alreadyViewed) return;

    try {
      await addDoc(collection(db, 'viewed_items'), {
        itemId: item.id,
        title: item.title,
        seller: item.seller,
        price: item.price,
        currency: item.currency,
        keywords: [searchQuery, ...includeKeywords],
        viewedAt: new Date().toISOString(),
        userId: user.uid
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'viewed_items');
    }
  };

  const saveSearch = async () => {
    if (!user || !searchQuery) return;
    const name = prompt('Enter a name for this search:');
    if (!name) return;

    try {
      await addDoc(collection(db, 'saved_searches'), {
        name,
        query: searchQuery,
        category: selectedCategoryId,
        minPrice: minPrice === '' ? null : minPrice,
        maxPrice: maxPrice === '' ? null : maxPrice,
        includeKeywords,
        excludeKeywords,
        excludeSellers,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'saved_searches');
    }
  };

  const deleteSavedSearch = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'saved_searches', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', 'saved_searches');
    }
  };

  const loadSavedSearch = (s: SavedSearch) => {
    setSearchQuery(s.query);
    setSelectedCategoryId(s.category || null);
    setMinPrice(s.minPrice || '');
    setMaxPrice(s.maxPrice || '');
    setIncludeKeywords(s.includeKeywords || []);
    setExcludeKeywords(s.excludeKeywords || []);
    setExcludeSellers(s.excludeSellers || []);
    setActiveTab('search');
    // Trigger search automatically
    setTimeout(() => handleSearch(), 100);
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    if (isExclude) {
      setExcludeKeywords([...excludeKeywords, newKeyword.trim()]);
    } else {
      setIncludeKeywords([...includeKeywords, newKeyword.trim()]);
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string, type: 'include' | 'exclude') => {
    if (type === 'include') {
      setIncludeKeywords(includeKeywords.filter(k => k !== kw));
    } else {
      setExcludeKeywords(excludeKeywords.filter(k => k !== kw));
    }
  };

  // Sorted and Filtered Results
  const processedResults = useMemo(() => {
    let filtered = results.filter(item => !hideViewed || !viewedAtSearchStart.has(item.id));

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      // For mock data, 'newest' and 'relevance' are same as original order
      return 0;
    });
  }, [results, hideViewed, viewedAtSearchStart, sortBy]);

  const downloadCSV = () => {
    if (processedResults.length === 0) return;

    const headers = ['ID', 'Title', 'Seller', 'Price', 'Currency', 'Category', 'URL'];
    const rows = processedResults.map(item => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`,
      item.seller,
      item.price,
      item.currency,
      `"${item.category}"`,
      item.url
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `allegro_search_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analytics Data
  const stats = useMemo(() => {
    const sellerCounts: Record<string, number> = {};
    const keywordCounts: Record<string, number> = {};
    const priceRanges: Record<string, number> = {
      '0-100': 0,
      '100-500': 0,
      '500-1000': 0,
      '1000-2000': 0,
      '2000+': 0
    };

    viewedItems.forEach(item => {
      sellerCounts[item.seller] = (sellerCounts[item.seller] || 0) + 1;
      item.keywords?.forEach(kw => {
        if (kw) keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      });

      if (item.price < 100) priceRanges['0-100']++;
      else if (item.price < 500) priceRanges['100-500']++;
      else if (item.price < 1000) priceRanges['500-1000']++;
      else if (item.price < 2000) priceRanges['1000-2000']++;
      else priceRanges['2000+']++;
    });

    const topSellers = Object.entries(sellerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topKeywords = Object.entries(keywordCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const priceDist = Object.entries(priceRanges).map(([range, count]) => ({ range, count }));

    return { topSellers, topKeywords, priceDist, totalViewed: viewedItems.length, uniqueSellers: Object.keys(sellerCounts).length };
  }, [viewedItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-mono uppercase tracking-widest opacity-50">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black flex items-center justify-center text-white">
              <Search size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight uppercase">Auction Search</h1>
          </div>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Powerful monitoring and analytics tool for Allegro. Track views, analyze sellers, and never miss a deal.
          </p>
          <button
            onClick={login}
            className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-800 transition-colors"
          >
            <LogIn size={20} />
            Connect with Google
          </button>
          <p className="mt-6 text-[10px] text-gray-400 uppercase tracking-widest text-center">
            Secure authentication via Google AI Studio
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white border-r border-black flex flex-col">
          <div className="p-6 border-bottom border-black flex items-center gap-3">
            <div className="w-8 h-8 bg-black flex items-center justify-center text-white">
              <Search size={18} />
            </div>
            <span className="font-bold uppercase tracking-tighter text-lg">Auction Tool</span>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => setActiveTab('search')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wider transition-all",
                activeTab === 'search' ? "bg-black text-white" : "hover:bg-gray-100"
              )}
            >
              <Search size={18} />
              Search
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wider transition-all",
                activeTab === 'history' ? "bg-black text-white" : "hover:bg-gray-100"
              )}
            >
              <History size={18} />
              History
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wider transition-all",
                activeTab === 'analytics' ? "bg-black text-white" : "hover:bg-gray-100"
              )}
            >
              <BarChart3 size={18} />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wider transition-all",
                activeTab === 'saved' ? "bg-black text-white" : "hover:bg-gray-100"
              )}
            >
              <Save size={18} />
              Saved
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wider transition-all",
                activeTab === 'settings' ? "bg-black text-white" : "hover:bg-gray-100"
              )}
            >
              <SettingsIcon size={18} />
              Settings
            </button>
          </nav>

          <div className="p-4 border-t border-black">
            <div className="flex items-center gap-3 mb-4 px-2">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-black" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{user.displayName}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-black hover:bg-black hover:text-white transition-all"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'search' && (
            <div className="p-6 max-w-5xl mx-auto">
              {/* Search Header */}
              <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold uppercase tracking-tighter mb-2 italic serif font-serif">Search Allegro</h2>
                  <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">Advanced Monitoring Interface v1.1</p>
                </div>
                <div className="bg-white border border-black p-3 text-[10px] font-bold uppercase tracking-widest flex flex-col gap-2">
                  {!isConfigured && !useAI && (
                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                      <Terminal size={12} />
                      <span>API Keys Missing - Using Scraper Fallback</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", useAI ? "bg-emerald-500" : (isConfigured ? "bg-blue-500" : "bg-amber-500"))}></div>
                      <span>Mode: {useAI ? 'AI Smart Search' : (isConfigured ? 'Allegro API' : 'Direct Scraper')}</span>
                    </div>
                    <button
                      onClick={() => setUseAI(!useAI)}
                      className="underline hover:text-gray-500"
                    >
                      Switch
                    </button>
                  </div>
                  <p className="text-gray-400 font-normal normal-case leading-tight max-w-[200px]">
                    {!isAllegroEnabled
                      ? "Allegro Service is currently disabled in Settings."
                      : useAI
                        ? "Using Gemini AI to find real Allegro listings without API keys."
                        : (isConfigured ? "Using official Allegro API for real-time data." : "Parsing Allegro website directly via proxy.")}
                  </p>
                </div>
              </div>

              {/* Search Form */}
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 overflow-x-auto whitespace-nowrap pb-2">
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={cn("hover:text-black", !selectedCategoryId && "text-black")}
                  >
                    All Categories
                  </button>
                  {selectedCategoryId && getCategoryPath(selectedCategoryId).map((cat) => (
                    <React.Fragment key={cat.id}>
                      <ChevronRight size={10} />
                      <button
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={cn("hover:text-black", selectedCategoryId === cat.id && "text-black")}
                      >
                        {cat.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.filter(c => c.parentId === selectedCategoryId).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="px-3 py-1.5 bg-white border border-black text-[10px] font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-all"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSearch} className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Search Phrase</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g. Szabla husarska"
                        className="w-full border border-black p-3 pl-10 focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Min Price (PLN)</label>
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border border-black p-3 focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Max Price (PLN)</label>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border border-black p-3 focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Keywords */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Keywords Filter</label>
                    <div className="flex items-center gap-4">
                      {(includeKeywords.length > 0 || excludeKeywords.length > 0) && (
                        <button
                          type="button"
                          onClick={() => { setIncludeKeywords([]); setExcludeKeywords([]); }}
                          className="text-[10px] font-bold uppercase text-rose-600 hover:underline"
                        >
                          Clear All
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsExclude(false)}
                          className={cn("px-2 py-1 text-[10px] font-bold uppercase", !isExclude ? "bg-black text-white" : "bg-gray-200")}
                        >
                          Include
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsExclude(true)}
                          className={cn("px-2 py-1 text-[10px] font-bold uppercase", isExclude ? "bg-black text-white" : "bg-gray-200")}
                        >
                          Exclude
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      placeholder={isExclude ? "Exclude word..." : "Include word..."}
                      className="flex-1 border border-black p-2 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="bg-black text-white p-2 hover:bg-gray-800"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {includeKeywords.map(kw => (
                      <span key={kw} className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 border border-emerald-200 flex items-center gap-1">
                        {kw}
                        <button type="button" onClick={() => removeKeyword(kw, 'include')}><X size={12} /></button>
                      </span>
                    ))}
                    {excludeKeywords.map(kw => (
                      <span key={kw} className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-1 border border-rose-200 flex items-center gap-1">
                        {kw}
                        <button type="button" onClick={() => removeKeyword(kw, 'exclude')}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Excluded Sellers */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Excluded Sellers</label>
                    {excludeSellers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExcludeSellers([])}
                        className="text-[10px] font-bold uppercase text-rose-600 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {excludeSellers.map(seller => (
                      <span key={seller} className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-1 border border-gray-200 flex items-center gap-1">
                        {seller}
                        <button type="button" onClick={() => setExcludeSellers(excludeSellers.filter(s => s !== seller))}><X size={12} /></button>
                      </span>
                    ))}
                    {excludeSellers.length === 0 && <p className="text-[10px] text-gray-400 italic">No sellers excluded</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <button
                    type="submit"
                    disabled={isSearching || !isAllegroEnabled}
                    className="flex-1 md:flex-none px-8 py-3 bg-black text-white font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{useAI ? 'AI Parsing...' : 'Allegro Parsing...'}</span>
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        <span>{!isAllegroEnabled ? "Service Inactive" : "Execute Search"}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={saveSearch}
                    className="px-8 py-3 border border-black font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    Save Search
                  </button>
                  <button
                    type="button"
                    onClick={downloadCSV}
                    disabled={processedResults.length === 0}
                    className="px-8 py-3 border border-black font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black"
                  >
                    <LayoutDashboard size={18} />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setHideViewed(!hideViewed)}
                    className={cn(
                      "px-8 py-3 border border-black font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                      hideViewed ? "bg-black text-white" : "hover:bg-gray-100"
                    )}
                  >
                    {hideViewed ? <EyeOff size={18} /> : <Eye size={18} />}
                    {hideViewed ? "Showing New" : "Hide Viewed"}
                  </button>
                </div>
              </form>

              {/* Results */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Results ({processedResults.length})</h3>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent border-none text-[10px] font-bold uppercase tracking-widest text-gray-500 focus:ring-0 cursor-pointer hover:text-black"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                    </select>
                  </div>
                  <div className="h-[1px] flex-1 mx-4 bg-black opacity-10"></div>
                </div>

                {processedResults.length === 0 && !isSearching && (
                  <div className="bg-white border border-black p-16 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="w-16 h-16 bg-gray-100 border border-black flex items-center justify-center mx-auto mb-6">
                      <Filter size={32} className="text-gray-400" />
                    </div>
                    <h4 className="text-xl font-bold uppercase tracking-tighter mb-2">No items found</h4>
                    <p className="text-gray-400 font-mono uppercase tracking-widest text-[10px] mb-8">Adjust your filters or try a different search query.</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setMinPrice('');
                        setMaxPrice('');
                        setIncludeKeywords([]);
                        setExcludeKeywords([]);
                        setExcludeSellers([]);
                        setSelectedCategoryId(null);
                      }}
                      className="px-8 py-3 bg-black text-white font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {processedResults.map((item, index) => {
                    const isViewed = viewedAtSearchStart.has(item.id);
                    const isMainProduct = index === 0;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "bg-white border border-black p-4 flex gap-6 transition-all group hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                            isViewed && "opacity-60 grayscale-[0.5]",
                            isMainProduct && "border-2 border-black ring-4 ring-black/5"
                          )}
                        >
                          <div className="w-32 h-32 flex-shrink-0 border border-black overflow-hidden relative">
                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            {isViewed && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                <Eye size={24} />
                              </div>
                            )}
                            {isMainProduct && (
                              <div className="absolute top-0 left-0 bg-black text-white text-[8px] font-bold uppercase px-2 py-1 tracking-widest">
                                Main Product
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{item.category}</p>
                                <h4 className="text-lg font-bold leading-tight group-hover:underline cursor-pointer">
                                  <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                                </h4>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold font-mono tracking-tighter">{item.price.toFixed(2)} {item.currency}</p>
                                <button
                                  onClick={() => !excludeSellers.includes(item.seller) && setExcludeSellers([...excludeSellers, item.seller])}
                                  className="group/seller flex items-center gap-1 ml-auto text-[10px] font-bold uppercase text-gray-400 hover:text-rose-600 transition-colors"
                                  title="Exclude this seller from future searches"
                                >
                                  <span>Seller: {item.seller}</span>
                                  <X size={10} className="opacity-0 group-hover/seller:opacity-100 transition-opacity" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-auto flex items-center justify-between">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => trackView(item)}
                                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-black hover:bg-black hover:text-white transition-all"
                                >
                                  {isViewed ? "Viewed" : "Mark as Viewed"}
                                </button>
                              </div>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:underline"
                              >
                                Open on Allegro <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-6 max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold uppercase tracking-tighter mb-2 italic serif font-serif">View History</h2>
                <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">Tracking {viewedItems.length} items</p>
              </div>

              <div className="bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black bg-gray-50">
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Date</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Item</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Seller</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Price</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewedItems.map(item => (
                      <tr key={item.id} className="border-b border-black hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-[10px] font-mono">
                          {new Date(item.viewedAt).toLocaleDateString()}<br/>
                          {new Date(item.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-bold truncate max-w-xs">{item.title}</p>
                          <div className="flex gap-1 mt-1">
                            {item.keywords?.slice(0, 2).map(kw => (
                              <span key={kw} className="text-[8px] uppercase bg-gray-100 px-1 border border-gray-200">{kw}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-xs font-medium">{item.seller}</td>
                        <td className="p-4 text-xs font-bold font-mono">{item.price.toFixed(2)} {item.currency}</td>
                        <td className="p-4">
                          <button
                            onClick={async () => {
                              if (item.id) {
                                try {
                                  await deleteDoc(doc(db, 'viewed_items', item.id));
                                } catch (e) {
                                  handleFirestoreError(e, 'delete', 'viewed_items');
                                }
                              }
                            }}
                            className="p-2 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6 max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold uppercase tracking-tighter mb-2 italic serif font-serif">Market Analytics</h2>
                <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">Based on your browsing behavior</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <BarChart3 size={14} /> Top Sellers
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.topSellers} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', color: '#fff', border: 'none', fontSize: '10px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="#000" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <Filter size={14} /> Popular Keywords
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.topKeywords}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                        >
                          {stats.topKeywords.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#000', '#333', '#666', '#999', '#ccc'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', color: '#fff', border: 'none', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <BarChart3 size={14} /> Price Distribution
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.priceDist}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="range" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', color: '#fff', border: 'none', fontSize: '10px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="#000" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-black p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Viewed</p>
                  <p className="text-4xl font-bold font-mono">{stats.totalViewed}</p>
                </div>
                <div className="bg-white border border-black p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Unique Sellers</p>
                  <p className="text-4xl font-bold font-mono">{stats.uniqueSellers}</p>
                </div>
                <div className="bg-white border border-black p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Saved Searches</p>
                  <p className="text-4xl font-bold font-mono">{savedSearches.length}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="p-6 max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold uppercase tracking-tighter mb-2 italic serif font-serif">Saved Searches</h2>
                <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">Quick access to your monitors</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedSearches.map(s => (
                  <div key={s.id} className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold uppercase tracking-tight group-hover:underline cursor-pointer" onClick={() => loadSavedSearch(s)}>
                          {s.name}
                        </h3>
                        <p className="text-[10px] font-mono text-gray-400">Created: {new Date(s.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => s.id && deleteSavedSearch(s.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 uppercase">Query:</span>
                        <span className="font-bold">{s.query}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 uppercase">Price Range:</span>
                        <span className="font-bold">
                          {s.minPrice || 0} - {s.maxPrice || '∞'} PLN
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => loadSavedSearch(s)}
                      className="w-full py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                    >
                      Run Search <ChevronRight size={14} />
                    </button>
                  </div>
                ))}

                {savedSearches.length === 0 && (
                  <div className="col-span-full bg-white border border-black p-12 text-center">
                    <p className="text-gray-400 font-mono uppercase tracking-widest text-sm">No saved searches yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="p-6 max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold uppercase tracking-tighter mb-2 italic serif font-serif">System Settings</h2>
                <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">Configure proxy and monitor system logs</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  {/* Allegro Service Status */}
                  <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest">Allegro Service Status</h3>
                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">Temporarily disable Allegro integration</p>
                      </div>
                      <button
                        onClick={() => setIsAllegroEnabled(!isAllegroEnabled)}
                        className={cn(
                          "w-12 h-6 border-2 border-black transition-all relative",
                          isAllegroEnabled ? "bg-black" : "bg-gray-100"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 border-2 border-black bg-white transition-all",
                          isAllegroEnabled ? "left-6" : "left-0.5"
                        )} />
                      </button>
                    </div>

                    {!isAllegroEnabled && (
                      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                          Maintenance Mode: Allegro service is currently inactive. Search functionality and data fetching are disabled. No configuration prompts will be shown.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Proxy Config */}
                  <div className={cn("bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]", !isAllegroEnabled && "opacity-40 pointer-events-none")}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                      <SettingsIcon size={14} /> Proxy Configuration
                    </h3>

                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Protocol</label>
                          <select
                            value={proxyConfig.protocol}
                            onChange={(e) => setProxyConfig({...proxyConfig, protocol: e.target.value})}
                            className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                          >
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                            <option value="socks4">SOCKS4</option>
                            <option value="socks5">SOCKS5</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Proxy Host (IP or Domain)</label>
                          <input
                            type="text"
                            value={proxyConfig.host}
                            onChange={(e) => setProxyConfig({...proxyConfig, host: e.target.value})}
                            placeholder="e.g. gw.2captcha.com"
                            className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Port</label>
                          <input
                            type="text"
                            value={proxyConfig.port}
                            onChange={(e) => setProxyConfig({...proxyConfig, port: e.target.value})}
                            className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Username</label>
                          <input
                            type="text"
                            value={proxyConfig.username}
                            onChange={(e) => setProxyConfig({...proxyConfig, username: e.target.value})}
                            className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Password</label>
                        <input
                          type="password"
                          value={proxyConfig.password}
                          onChange={(e) => setProxyConfig({...proxyConfig, password: e.target.value})}
                          className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                        />
                      </div>

                      <div className="pt-4 flex gap-4">
                        <button
                          onClick={async () => {
                            addLog("Testing proxy connection...", "info");
                            try {
                              const headers: any = {};
                              if (proxyConfig.host) {
                                headers['x-proxy-protocol'] = proxyConfig.protocol;
                                headers['x-proxy-host'] = proxyConfig.host;
                                headers['x-proxy-port'] = proxyConfig.port;
                                headers['x-proxy-user'] = proxyConfig.username;
                                headers['x-proxy-pass'] = proxyConfig.password;
                              }
                              const res = await fetch('/api/test-proxy', { headers });
                              const data = await res.json();
                              if (res.ok) {
                                addLog(`Proxy Success: ${data.data.query} (${data.data.country})`, "success");
                              } else {
                                addLog(`Proxy Error: ${data.message}`, "error");
                              }
                            } catch (e) {
                              addLog(`Connection Error: ${String(e)}`, "error");
                            }
                          }}
                          className="flex-1 py-3 border border-black font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                        >
                          Test Connection
                        </button>
                        <button
                          onClick={() => {
                            addLog("Proxy settings saved locally", "success");
                          }}
                          className="flex-1 py-3 bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-gray-800 transition-all"
                        >
                          Save Settings
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CAPTCHA Config */}
                  <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                      <Eye size={14} /> CAPTCHA Solver
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Solving Service</label>
                        <select
                          value={captchaConfig.service}
                          onChange={(e) => setCaptchaConfig({...captchaConfig, service: e.target.value as any})}
                          className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                        >
                          <option value="manual">Manual Entry (Free)</option>
                          <option value="2captcha">2Captcha (Auto)</option>
                          <option value="anticaptcha">Anti-Captcha (Auto)</option>
                        </select>
                      </div>

                      {captchaConfig.service !== 'manual' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">API Key</label>
                          <input
                            type="password"
                            value={captchaConfig.apiKey}
                            onChange={(e) => setCaptchaConfig({...captchaConfig, apiKey: e.target.value})}
                            placeholder="Enter your service API key"
                            className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-3 bg-gray-50 border border-black">
                        <input
                          type="checkbox"
                          id="autoSolve"
                          checked={captchaConfig.autoSolve}
                          onChange={(e) => setCaptchaConfig({...captchaConfig, autoSolve: e.target.checked})}
                          className="w-4 h-4 border-black rounded-none text-black focus:ring-0"
                        />
                        <label htmlFor="autoSolve" className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                          Enable Automatic Solving
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
          {captchaChallenge && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border-2 border-black p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold uppercase tracking-tighter italic serif font-serif">Security Challenge</h3>
                  <button onClick={() => setCaptchaChallenge(null)} className="text-gray-400 hover:text-black">
                    <X size={20} />
                  </button>
                </div>

                <p className="text-xs text-gray-500 mb-6 uppercase tracking-widest leading-relaxed">
                  Allegro requires a verification to continue. Please solve the challenge below.
                </p>

                <div className="bg-gray-100 border border-black p-4 mb-6 flex flex-col items-center justify-center min-h-[150px]">
                  {captchaChallenge.imageUrl ? (
                    <img
                      src={captchaChallenge.imageUrl}
                      alt="Captcha Challenge"
                      className="max-w-full h-auto border border-black"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">Loading {captchaChallenge.type}...</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Enter Solution</label>
                    <input
                      type="text"
                      value={captchaSolution}
                      onChange={(e) => setCaptchaSolution(e.target.value)}
                      placeholder="Type the characters you see"
                      className="w-full border-2 border-black p-3 font-mono text-sm focus:ring-0 focus:border-black"
                      autoFocus
                    />
                  </div>

                  <button
                    disabled={isSolving || !captchaSolution}
                    onClick={async () => {
                      setIsSolving(true);
                      addLog(`Submitting CAPTCHA solution: ${captchaSolution}`, "info");
                      try {
                        const res = await fetch('/api/solve-captcha', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            challengeId: captchaChallenge.id,
                            solution: captchaSolution,
                            apiKey: captchaConfig.apiKey,
                            service: captchaConfig.service
                          })
                        });

                        if (res.ok) {
                          addLog("CAPTCHA solution accepted", "success");
                          setCaptchaChallenge(null);
                          setCaptchaSolution('');
                          handleSearch(); // Retry search
                        } else {
                          addLog("CAPTCHA solution rejected", "error");
                        }
                      } catch (e) {
                        addLog(`Error submitting CAPTCHA: ${String(e)}`, "error");
                      } finally {
                        setIsSolving(false);
                      }
                    }}
                    className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    {isSolving ? "Verifying..." : "Verify & Continue"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Global Logs Panel */}
        <div className={cn(
          "fixed bottom-0 right-0 z-40 transition-all duration-300 shadow-[-4px_-4px_0px_0px_rgba(0,0,0,1)] bg-black text-emerald-400 font-mono text-[10px] flex flex-col border-t-2 border-l-2 border-emerald-500",
          isLogsPanelOpen ? "w-[400px] h-[300px]" : "w-[400px] h-[40px]"
        )}>
          <div
            className="flex items-center justify-between p-2 cursor-pointer border-b border-emerald-900/50 hover:bg-emerald-900/20"
            onClick={() => setIsLogsPanelOpen(!isLogsPanelOpen)}
          >
            <h3 className="text-white font-bold uppercase tracking-widest flex items-center gap-2">
              <Terminal size={14} /> System Logs {logs.length > 0 && `(${logs.length})`}
            </h3>
            <button className="text-white/50 hover:text-white transition-colors">
              {isLogsPanelOpen ? <X size={14} /> : <ChevronRight size={14} className="rotate-[-90deg]" />}
            </button>
          </div>

          {isLogsPanelOpen && (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 p-3 custom-scrollbar flex flex-col-reverse">
                {logs.length === 0 && <p className="opacity-30 italic">No logs recorded yet...</p>}
                {logs.map((log, i) => (
                  <div key={i} className={cn(
                    "flex gap-3",
                    log.type === 'error' ? "text-rose-400" : log.type === 'success' ? "text-emerald-400" : "text-gray-400"
                  )}>
                    <span className="opacity-40 shrink-0">[{log.time}]</span>
                    <span className="flex-1 break-words">{log.msg}</span>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-emerald-900/50 flex justify-end">
                <button
                  onClick={() => setLogs([])}
                  className="text-white/50 hover:text-white transition-colors uppercase font-bold tracking-widest text-[8px]"
                >
                  Clear Logs
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </ErrorBoundary>
  );
}
