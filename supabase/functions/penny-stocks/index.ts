import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;
const MIN_PRICE_USD = 1000 / KRW_RATE;

function getToken(): string {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) throw new Error('FINNHUB_API_KEY not configured');
  return key;
}

const quoteCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 8000;

function getCached(key: string): any | null {
  const entry = quoteCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key: string, data: any) {
  quoteCache.set(key, { data, ts: Date.now() });
}

let lastCallTs = 0;
const MIN_INTERVAL = 350;

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

// ===== 200+ penny/small-cap tickers — 다양한 업종 전체 커버 =====
const ALL_TICKERS = [
  // EV & Clean Energy
  'NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
  'EVGO', 'BLNK', 'HYLN', 'XOS', 'CENN', 'JOBY', 'ARVL', 'BEEM', 'SES', 'QS',
  // Cannabis
  'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD', 'GRWG', 'CRON',
  // Biotech / Health
  'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC', 'HIMS', 'IBRX', 'NUVB', 'CANO',
  'AGEN', 'APLS', 'ARQT', 'BCRX', 'BTAI', 'CARA', 'CMPS', 'CTLT', 'EXAI', 'FOLD',
  'GTHX', 'IMVT', 'KRTX', 'MGTA', 'OLINK', 'PRAX', 'RXRX', 'SDGR', 'TALK', 'VERA',
  // Fintech
  'SOFI', 'HOOD', 'PSFE', 'AFRM', 'BKKT', 'UPST', 'PAYO', 'OLO', 'FLYW', 'RSKD',
  // Tech / AI / Quantum
  'WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'RGTI', 'QUBT', 'QBTS',
  'KULR', 'LIDR', 'MVIS', 'NNDM', 'LAZR', 'OUST', 'AEVA', 'VLDX', 'INDI', 'MKFG',
  'BBAI', 'SOUN', 'ARQQ', 'ACHR', 'SMRT', 'IQ', 'ATER',
  // Telecom / Media
  'SIRI', 'NOK', 'BB', 'GSAT', 'TELL', 'LUMN', 'IRDM',
  // Mining / Crypto
  'BTG', 'FSM', 'GPL', 'GATO', 'USAS', 'MARA', 'RIOT', 'BITF', 'HUT', 'CLSK', 'WULF',
  'BTBT', 'CIFR', 'BTDR', 'SOS', 'EBON', 'ANY', 'VYGR',
  // Space / Defense
  'ASTS', 'RKLB', 'LUNR', 'RDW', 'WRAP', 'SPCE', 'MNTS', 'ASTR',
  // Industrial / Materials
  'DM', 'EOSE', 'FLNC', 'GLS', 'KORE', 'SHLS', 'ORGN', 'STEM', 'TPIC', 'VLD',
  'UEC', 'AMPX', 'ARRY', 'FREY', 'MVST', 'WKSP', 'ENVX',
  // Consumer / Retail
  'CLOV', 'YEXT', 'ZETA', 'MAPS', 'TRMR', 'REAL', 'PERI', 'VERX',
  'BIRD', 'PRPL', 'RVLV', 'COOK', 'CRCT', 'LOVE', 'LE', 'RENT',
  // Media / Entertainment
  'GENI', 'CURI', 'PLBY', 'MYPS',
  // REITs / Real Estate
  'ACRE', 'ARI', 'BRSP', 'GPMT', 'RC', 'NYMT',
  // Extra small-caps
  'APGE', 'APPH', 'BFLY', 'BMEA', 'CHRS', 'CMPO', 'CZOO', 'DAVE',
  'DOMO', 'EDIT', 'FIGS', 'GDRX', 'GRPN', 'HIMX', 'HYMC',
  'IMPP', 'LITM', 'MEGL', 'MLGO', 'NBEV', 'NRDS', 'OPFI', 'OTRK',
  'PLTK', 'RCAT', 'RVPH', 'SNAP', 'SQSP', 'TDUP', 'UNFI',
  'XELA', 'XNET', 'ZENV',
];

// Dynamic rotation: scan 30 tickers per call, rotate through full universe
const GROUP_SIZE = 30;
let rotationIndex = 0;

// Store scanned data across rotations
const scannedQuotes: Map<string, any> = new Map();
const scannedTimestamps: Map<string, number> = new Map();
const STALE_THRESHOLD = 60000; // 60s — evict stale entries

let lastResponseCache: { data: any; timestamp: number } | null = null;
const RESPONSE_CACHE_TTL = 8000;

function calcCompositeScore(quote: any): number {
  const changePct = quote.dp || 0;
  const price = quote.c || 0;

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

  const dayRange = (quote.h || 0) - (quote.l || 0);
  const avgRange = price > 0 ? (dayRange / price) * 100 : 0;
  let volScore = 0;
  if (avgRange >= 15) volScore = 30;
  else if (avgRange >= 10) volScore = 25;
  else if (avgRange >= 7) volScore = 20;
  else if (avgRange >= 5) volScore = 15;
  else if (avgRange >= 3) volScore = 10;
  else volScore = 5;

  let momentumScore = 0;
  if (dayRange > 0) {
    const posInRange = (price - (quote.l || 0)) / dayRange;
    momentumScore = Math.round(posInRange * 20);
  } else {
    momentumScore = changePct > 0 ? 10 : 5;
  }

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

      // Dynamic rotation: scan 30 tickers per call
      const startIdx = (rotationIndex * GROUP_SIZE) % ALL_TICKERS.length;
      const tickers: string[] = [];
      for (let i = 0; i < GROUP_SIZE; i++) {
        tickers.push(ALL_TICKERS[(startIdx + i) % ALL_TICKERS.length]);
      }
      rotationIndex++;

      for (const sym of tickers) {
        try {
          const quote = await finnhubFetch(`/quote?symbol=${sym}`);
          if (!quote || !quote.c || quote.c <= 0) continue;

          const price = quote.c;
          if (price < MIN_PRICE_USD || price >= 10) continue;

          const changePct = quote.dp || 0;
          const compositeScore = calcCompositeScore(quote);
          const dayRange = ((quote.h || 0) - (quote.l || 0));
          const dayRangePct = price > 0 ? (dayRange / price) * 100 : 0;

          scannedQuotes.set(sym, {
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
          scannedTimestamps.set(sym, Date.now());
        } catch (e: any) {
          if (e.message?.includes('rate limit') || e.message?.includes('429')) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      // Evict stale entries (not scanned in 60s)
      const now = Date.now();
      for (const [sym, ts] of scannedTimestamps) {
        if (now - ts > STALE_THRESHOLD) {
          scannedQuotes.delete(sym);
          scannedTimestamps.delete(sym);
        }
      }

      // Merge all, sort by composite score, top 50
      const allQuotes = Array.from(scannedQuotes.values());
      allQuotes.sort((a, b) => b.compositeScore - a.compositeScore);
      const top50 = allQuotes.slice(0, 50);

      const result = {
        stocks: top50,
        total: top50.length,
        allScanned: allQuotes.length,
        rotationGroup: (rotationIndex % Math.ceil(ALL_TICKERS.length / GROUP_SIZE)) + 1,
        totalGroups: Math.ceil(ALL_TICKERS.length / GROUP_SIZE),
        universeSize: ALL_TICKERS.length,
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
