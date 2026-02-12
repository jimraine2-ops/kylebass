import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function getToken(): string {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) throw new Error('FINNHUB_API_KEY not configured');
  return key;
}

async function finnhubFetch(path: string) {
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FINNHUB_BASE}${path}${sep}token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error('Finnhub rate limit');
    throw new Error(`Finnhub ${res.status}`);
  }
  return res.json();
}

// Expanded pool: 100+ under-$10 candidates across sectors
const UNDER10_TICKERS = [
  // EV / Clean Energy
  'NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
  // Cannabis
  'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD',
  // Biotech / Health
  'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC',
  // Tech / Fintech
  'SOFI', 'HOOD', 'PSFE', 'WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'QS',
  // Telecom / Media
  'SIRI', 'NOK', 'BB', 'TELL', 'CLOV',
  // Space / Quantum
  'ASTS', 'RKLB', 'LUNR', 'RGTI', 'QUBT',
  // Mining / Commodities
  'BTG', 'FSM', 'GPL', 'GATO', 'USAS',
  // Small-cap momentum
  'MARA', 'RIOT', 'BITF', 'HUT', 'CLSK',
  'AFRM', 'BKKT', 'CENN', 'EVGO', 'GSAT',
  'HIMS', 'IBRX', 'JOBY', 'KULR', 'LIDR',
  'MVIS', 'NNDM', 'ORGN', 'PAYO', 'QBTS',
  'RDW', 'STEM', 'TPIC', 'UEC', 'VLD',
  'WULF', 'XOS', 'YEXT', 'ZETA', 'AEVA',
  'AMPX', 'ARVL', 'BEEM', 'BLNK', 'CANO',
  'DM', 'EOSE', 'FLNC', 'GLS', 'HYLN',
  'IEC', 'JNPR', 'KORE', 'LAZR', 'MAPS',
  'NUVB', 'OUST', 'PERI', 'RENT', 'SHLS',
  'TRMR', 'UPST', 'VNET', 'WRAP', 'XPEV',
  'ARQQ', 'BMBL', 'CRSP', 'DNMR', 'ENVX',
];

// In-memory cache for rate limit management
let cachedResult: { stocks: any[]; total: number; allScanned: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 25000; // 25 seconds cache

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'scan' || action === 'top10' || action === 'top50') {
      // Return cached result if fresh enough
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
        return new Response(JSON.stringify(cachedResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const allQuotes: any[] = [];

      // Phase 1: Quote-only scan (fast, 1 API call per ticker)
      for (const sym of UNDER10_TICKERS) {
        try {
          await new Promise(r => setTimeout(r, 250));
          const quote = await finnhubFetch(`/quote?symbol=${sym}`);
          const price = quote.c;
          if (!price || price <= 0 || price >= 10) continue;

          const changePct = quote.dp || 0;
          const currentVol = 0; // skip candle calls for speed
          const volumeSurge = 0;

          // Score based on available data: change% weighted heavily
          const changeScore = Math.min(Math.max(changePct, 0) * 5, 70);
          const priceScore = price < 1 ? 20 : price < 3 ? 15 : price < 5 ? 10 : 5;
          const compositeScore = +(changeScore + priceScore).toFixed(1);

          allQuotes.push({
            symbol: sym,
            shortName: sym,
            regularMarketPrice: price,
            regularMarketChange: quote.d || 0,
            regularMarketChangePercent: changePct,
            regularMarketVolume: currentVol,
            averageDailyVolume10Day: 0,
            volumeSurge,
            isVolumeSurge: false,
            isHot: changePct >= 20,
            previousClose: quote.pc,
            dayHigh: quote.h,
            dayLow: quote.l,
            compositeScore,
          });
        } catch (e: any) {
          if (e.message === 'Finnhub rate limit') {
            // Wait longer and continue
            await new Promise(r => setTimeout(r, 2000));
          }
          // skip ticker
        }
      }

      // Sort by composite score descending, take TOP 50
      allQuotes.sort((a, b) => b.compositeScore - a.compositeScore);
      const top50 = allQuotes.slice(0, 50);

      const result = {
        stocks: top50,
        total: top50.length,
        allScanned: allQuotes.length,
        timestamp: Date.now(),
      };
      cachedResult = result;

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
