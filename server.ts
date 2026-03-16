import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as cheerio from 'cheerio';

// Proxy Configuration
const getProxyConfig = (req?: express.Request, targetUrl?: string) => {
  const protocol = (req?.headers['x-proxy-protocol'] as string || process.env.PROXY_PROTOCOL || 'http').toLowerCase();
  let host = req?.headers['x-proxy-host'] as string || process.env.PROXY_HOST || 'eu.proxy.2captcha.com';
  const port = req?.headers['x-proxy-port'] as string || process.env.PROXY_PORT || '2334';
  const username = req?.headers['x-proxy-user'] as string || process.env.PROXY_USERNAME || 'ua968b7d956db05c7-zone-custom';
  const password = req?.headers['x-proxy-pass'] as string || process.env.PROXY_PASSWORD || 'ua968b7d956db05c7';

  // Safeguard against 'ip' placeholder
  if (host === 'ip') {
    console.log("[Proxy] 'ip' placeholder detected, falling back to default host.");
    host = 'eu.proxy.2captcha.com';
  }

  if (!host || !port) return {};

  const auth = username && password ? `${username}:${password}@` : '';
  const proxyUrl = `${protocol}://${auth}${host}:${port}`;

  console.log(`[Proxy] Using: ${protocol}://${host}:${port} for target: ${targetUrl || 'unknown'}`);

  // For HTTPS targets, HttpsProxyAgent is much more reliable than axios proxy config
  if (targetUrl?.startsWith('https') || protocol.startsWith('socks')) {
    const agent = protocol.startsWith('socks')
      ? new SocksProxyAgent(proxyUrl)
      : new HttpsProxyAgent(proxyUrl);
    return { httpAgent: agent, httpsAgent: agent };
  }

  // Default axios proxy config (only for HTTP targets)
  return {
    proxy: {
      protocol: 'http',
      host,
      port: parseInt(port),
      auth: username && password ? { username, password } : undefined,
    },
  };
};

async function scrapeAllegro(phrase: string, categoryId?: string, minPrice?: string, maxPrice?: string, req?: express.Request) {
  console.log(`[Scraper] Attempting to parse Allegro website for: "${phrase}"`);

  try {
    const params = new URLSearchParams();
    params.append('string', phrase);
    if (minPrice) params.append('price_from', minPrice);
    if (maxPrice) params.append('price_to', maxPrice);

    // Allegro search URL
    const url = `https://allegro.pl/listing?${params.toString()}${categoryId ? `&category.id=${categoryId}` : ''}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      ...getProxyConfig(req, url),
      timeout: 15000
    });

    if (response.data.includes('captcha') || response.data.includes('Cloudflare') || response.status === 403) {
      console.warn("[Scraper] Blocked by Allegro (CAPTCHA or Cloudflare detected).");
      throw new Error("BLOCKED_BY_CLOUDFLARE_OR_CAPTCHA");
    }

    const $ = cheerio.load(response.data);
    const items: any[] = [];

    // Allegro's listing structure (this is a best-effort parse as it changes frequently)
    $('article[data-item="true"]').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2').text().trim();
      const priceText = $el.find('span[data-testid="price"]').first().text().trim();
      const price = parseFloat(priceText.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
      const currency = priceText.includes('zł') ? 'PLN' : 'PLN';
      const url = $el.find('a').first().attr('href') || '';
      const id = url.split('-').pop() || `scraped-${i}`;
      const thumbnail = $el.find('img').first().attr('src') || 'https://picsum.photos/200/200';
      const seller = $el.find('span:contains("od")').first().text().replace('od', '').trim() || 'Allegro Seller';

      if (title && url) {
        items.push({
          id,
          title,
          seller,
          price,
          currency,
          category: categoryId || 'unknown',
          thumbnail,
          url: url.startsWith('http') ? url : `https://allegro.pl${url}`
        });
      }
    });

    if (items.length === 0) {
        console.warn("[Scraper] Parsing succeeded but 0 items found. The DOM structure may have changed, or proxy is returning an empty page.");
        throw new Error("NO_ITEMS_FOUND_OR_BLOCKED_SILENTLY");
    }

    console.log(`[Scraper] Successfully parsed ${items.length} items from website`);
    return items;
  } catch (error: any) {
    console.error(`[Scraper] Error parsing Allegro website: ${error.message}`);
    // Rethrow standard error with details for the client
    if (error.response) {
      console.error(`[Scraper] Response Status: ${error.response.status}`);
      if (error.response.status === 403) {
        throw new Error("PROXY_BLOCKED_403");
      }
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Allegro API Configuration
  const isSandbox = process.env.ALLEGRO_USE_SANDBOX === 'true';
  const ALLEGRO_AUTH_URL = isSandbox
    ? 'https://allegro.pl.allegrosandbox.pl/auth/oauth/token'
    : 'https://allegro.pl/auth/oauth/token';
  const ALLEGRO_API_URL = isSandbox
    ? 'https://api.allegro.pl.allegrosandbox.pl'
    : 'https://api.allegro.pl';

  let cachedToken: string | null = null;
  let tokenExpiry: number = 0;

  async function getAllegroToken(req?: express.Request) {
    if (cachedToken && Date.now() < tokenExpiry) {
      return cachedToken;
    }

    console.log("[Allegro] Fetching new access token...");
    const clientId = process.env.ALLEGRO_CLIENT_ID;
    const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn("[Allegro] Warning: Missing Client ID or Secret. API calls will fail.");
      throw new Error("ALLEGRO_CLIENT_ID or ALLEGRO_CLIENT_SECRET missing. Please set them in environment variables.");
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const proxyConfig = getProxyConfig(req, ALLEGRO_AUTH_URL);
      const response = await axios.post(
        ALLEGRO_AUTH_URL,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          ...proxyConfig,
          timeout: 15000
        }
      );

      console.log("[Allegro] Token received successfully");
      cachedToken = response.data.access_token;
      tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer
      return cachedToken;
    } catch (error: any) {
      console.error("[Allegro] Token Error:", error.response?.data || error.message);
      if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
        console.error("[Proxy] Connection failed. Check if proxy host/port is correct.");
      }
      throw error;
    }
  }

  // API Routes
  app.get("/api/search", async (req, res) => {
    const { phrase, categoryId, minPrice, maxPrice } = req.query as any;
    console.log(`[API] Search request for: "${phrase}"`);

    try {
      let token;
      try {
        token = await getAllegroToken(req);
      } catch (tokenError) {
        console.warn("[Allegro] API Token failed, falling back to scraper...");
        try {
          const scrapedItems = await scrapeAllegro(phrase, categoryId, minPrice, maxPrice, req);
          return res.json(scrapedItems);
        } catch (scraperError: any) {
           console.warn(`[Scraper Error fallback from token fail]: ${scraperError.message}`);
           throw scraperError;
        }
      }

      const params: any = {
        phrase: phrase || '',
        'price.from': minPrice,
        'price.to': maxPrice,
      };

      if (categoryId) {
        params['category.id'] = categoryId;
      }

      console.log(`[Allegro] Calling listing API with params:`, params);

      let response;
      try {
        response = await axios.get(`${ALLEGRO_API_URL}/offers/listing`, {
          params,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.allegro.public.v1+json'
          },
          ...getProxyConfig(req, ALLEGRO_API_URL),
          timeout: 15000
        });
      } catch (apiError: any) {
        console.warn("[Allegro] API call failed, falling back to scraper...");
        const scrapedItems = await scrapeAllegro(phrase, categoryId, minPrice, maxPrice, req);
        return res.json(scrapedItems);
      }

      console.log(`[Allegro] Found ${response.data.items.regular.length} items`);

      // Map Allegro API response to our AllegroItem type
      const items = response.data.items.regular.map((item: any) => ({
        id: item.id,
        title: item.name,
        seller: item.seller.login,
        price: parseFloat(item.sellingMode.price.amount),
        currency: item.sellingMode.price.currency,
        category: item.category.id,
        thumbnail: item.images[0]?.url || 'https://picsum.photos/200/200',
        url: `https://allegro.pl/oferta/${item.id}`
      }));

      res.json(items);
    } catch (error: any) {
      console.error("[API] Search Error:", error.response?.data || error.message);
      const status = error.response?.status || 500;
      let message = error.response?.data?.error_description || error.message;

      // Formatting known proxy/scraper errors for frontend
      if (message.includes('PROXY_BLOCKED_403') || message.includes('403')) {
          message = "Proxy blocked by Allegro (403 Forbidden). Try rotating proxy or using AI search.";
      } else if (message.includes('BLOCKED_BY_CLOUDFLARE_OR_CAPTCHA')) {
          message = "Scraper blocked by Cloudflare or CAPTCHA. Proxy is detected by Allegro.";
      } else if (message.includes('NO_ITEMS_FOUND_OR_BLOCKED_SILENTLY')) {
          message = "Scraper returned 0 items. The page structure might have changed or Allegro returned an empty page.";
      }

      res.status(status).json({ error: message, originalError: error.message });
    }
  });

  // Proxy Test Route
  app.get("/api/test-proxy", async (req, res) => {
    console.log("[Test] Testing proxy connection...");
    try {
      const response = await axios.get('http://ip-api.com/json', getProxyConfig(req));
      console.log("[Test] Proxy Success:", response.data);
      res.json({ status: 'success', data: response.data });
    } catch (error: any) {
      console.error("[Test] Proxy Failure:", error.response?.data || error.message);
      res.status(500).json({ status: 'error', message: error.message, details: error.response?.data });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // CAPTCHA Solve Route
app.post('/api/solve-captcha', async (req, res) => {
  const { challengeId, solution, apiKey, service } = req.body;

  console.log(`[Captcha] Solving challenge ${challengeId} via ${service} with solution: ${solution}`);

  if (service !== 'manual' && apiKey) {
    // Here you would implement the 2Captcha/Anti-Captcha API calls
    // Example for 2Captcha:
    // 1. Send captcha to 2captcha.com/in.php
    // 2. Poll 2captcha.com/res.php for result
    console.log(`[Captcha] Auto-solving with ${service} key: ${apiKey.substring(0, 4)}...`);
  }

  // In a real scenario, you would send this to Allegro
  res.json({ success: true, message: 'Captcha solved' });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
