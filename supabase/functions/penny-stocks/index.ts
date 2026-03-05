import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;
const MIN_PRICE_USD = 1000 / KRW_RATE; // ₩1,000 하한

function getToken(): string {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) throw new Error('FINNHUB_API_KEY not configured');
  return key;
}

// In-memory cache per isolate
const quoteCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 8000; // 8s — aggressive refresh for top gainers

function getCached(key: string): any | null {
  const entry = quoteCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key: string, data: any) {
  quoteCache.set(key, { data, ts: Date.now() });
}

let lastCallTs = 0;
const MIN_INTERVAL = 350; // 350ms between calls

async function finnhubFetch(path: string): Promise<any> {
  const cached = getCached(path);
  if (cached) return cached;

  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL - (now - lastCallTs));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTs = Date.now();

  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FINNHUB_BASE}${path}${sep}token=${token}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await res.text();
        if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
        return null;
      }
      if (!res.ok) { await res.text(); return null; }
      const data = await res.json();
      setCache(path, data);
      return data;
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

// ===== Full candidate pool: 100+ penny/small-cap tickers =====
const ALL_TICKERS = [
  // EV & Clean Energy
  'NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
  'EVGO', 'BLNK', 'HYLN', 'XOS', 'CENN', 'JOBY', 'ARVL', 'BEEM',
  // Cannabis
  'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD',
  // Biotech / Health
  'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC', 'HIMS', 'IBRX', 'NUVB', 'CANO',
  // Fintech
  'SOFI', 'HOOD', 'PSFE', 'AFRM', 'BKKT', 'UPST', 'PAYO',
  // Tech / AI / Quantum
  'WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'QS', 'RGTI', 'QUBT', 'QBTS',
  'KULR', 'LIDR', 'MVIS', 'NNDM', 'LAZR', 'OUST', 'AEVA',
  // Telecom / Media
  'SIRI', 'NOK', 'BB', 'GSAT', 'TELL',
  // Mining / Crypto
  'BTG', 'FSM', 'GPL', 'GATO', 'USAS', 'MARA', 'RIOT', 'BITF', 'HUT', 'CLSK', 'WULF',
  // Space / Defense
  'ASTS', 'RKLB', 'LUNR', 'RDW', 'WRAP',
  // Other small-caps
  'CLOV', 'ORGN', 'STEM', 'TPIC', 'UEC', 'VLD', 'YEXT', 'ZETA', 'AMPX',
  'DM', 'EOSE', 'FLNC', 'GLS', 'KORE', 'MAPS', 'SHLS', 'TRMR', 'VNET', 'XPEV', 'ARQQ', 'ENVX',
];

// 4-group rotation for timeout safety (~25 each, ~8s per call)
const GROUP_SIZE = 25;
const GROUPS: string[][] = [];
for (let i = 0; i < ALL_TICKERS.length; i += GROUP_SIZE) {
  GROUPS.push(ALL_TICKERS.slice(i, i + GROUP_SIZE));
}

let rotationIndex = 0;
const cachedGroups: any[][] = new Array(GROUPS.length).fill(null).map(() => []);
let lastResponseCache: { data: any; timestamp: number } | null = null;
const RESPONSE_CACHE_TTL = 8000; // 8s

// ===== Composite Score: Volume Spike + Price Surge + Momentum =====
function calcCompositeScore(quote: any): number {
  const changePct = quote.dp || 0;
  const price = quote.c || 0;

  // 1) Price surge score (0-40): 급등률이 높을수록 가산
  let surgeScore = 0;
  if (changePct >= 20) surgeScore = 40;
  else if (changePct >= 15) surgeScore = 35;
  else if (changePct >= 10) surgeScore = 30;
  else if (changePct >= 7) surgeScore = 25;
  else if (changePct >= 5) surgeScore = 20;
  else if (changePct >= 3) surgeScore = 15;
  else if (changePct >= 1) surgeScore = 8;
  else if (changePct >= 0) surgeScore = 3;
  else surgeScore = 0;

  // 2) Volume spike score (0-30): day range vs previous close → proxy for volume activity
  const dayRange = (quote.h || 0) - (quote.l || 0);
  const avgRange = price > 0 ? (dayRange / price) * 100 : 0;
  let volScore = 0;
  if (avgRange >= 15) volScore = 30;
  else if (avgRange >= 10) volScore = 25;
  else if (avgRange >= 7) volScore = 20;
  else if (avgRange >= 5) volScore = 15;
  else if (avgRange >= 3) volScore = 10;
  else volScore = 5;

  // 3) Momentum score (0-20): price position within day range (close near high = strong)
  let momentumScore = 0;
  if (dayRange > 0) {
    const posInRange = (price - (quote.l || 0)) / dayRange;
    momentumScore = Math.round(posInRange * 20);
  } else {
    momentumScore = changePct > 0 ? 10 : 5;
  }

  // 4) Price tier bonus (0-10): smaller price → higher volatility potential
  let priceBonus = 0;
  if (price < 1) priceBonus = 10;
  else if (price < 2) priceBonus = 8;
  else if (price < 3) priceBonus = 6;
  else if (price < 5) priceBonus = 4;
  else priceBonus = 2;

  return Math.min(100, surgeScore + volScore + momentumScore + priceBonus);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'scan' || action === 'top10' || action === 'top50') {
      // Return cached if fresh
      if (lastResponseCache && Date.now() - lastResponseCache.timestamp < RESPONSE_CACHE_TTL) {
        return new Response(JSON.stringify(lastResponseCache.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Scan one group per call for timeout safety
      const groupIdx = rotationIndex % GROUPS.length;
      const tickers = GROUPS[groupIdx];
      rotationIndex++;

      const freshQuotes: any[] = [];

      for (const sym of tickers) {
        try {
          const quote = await finnhubFetch(`/quote?symbol=${sym}`);
          if (!quote || !quote.c || quote.c <= 0) continue;

          const price = quote.c;
          // ₩1,000 미만 제외 ($10 이상도 제외)
          if (price < MIN_PRICE_USD || price >= 10) continue;

          const changePct = quote.dp || 0;
          const compositeScore = calcCompositeScore(quote);
          const dayRange = ((quote.h || 0) - (quote.l || 0));
          const dayRangePct = price > 0 ? (dayRange / price) * 100 : 0;

          freshQuotes.push({
            symbol: sym,
            shortName: sym,
            regularMarketPrice: price,
            regularMarketChange: quote.d || 0,
            regularMarketChangePercent: changePct,
            regularMarketVolume: 0,
            previousClose: quote.pc,
            dayHigh: quote.h,
            dayLow: quote.l,
            openPrice: quote.o,
            dayRangePct: +dayRangePct.toFixed(1),
            compositeScore,
            isHot: changePct >= 10,
            isVolumeSurge: dayRangePct >= 7,
          });
        } catch (e: any) {
          if (e.message?.includes('rate limit') || e.message?.includes('429')) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      // Update this group's cache
      cachedGroups[groupIdx] = freshQuotes;

      // Merge all groups, sort by composite score (highest first), top 50
      const allQuotes = cachedGroups.flat();
      allQuotes.sort((a, b) => b.compositeScore - a.compositeScore);
      const top50 = allQuotes.slice(0, 50);

      const result = {
        stocks: top50,
        total: top50.length,
        allScanned: allQuotes.length,
        rotationGroup: groupIdx + 1,
        totalGroups: GROUPS.length,
        timestamp: Date.now(),
      };
      lastResponseCache = { data: result, timestamp: Date.now() };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Penny stocks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
