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

// Full candidate pool split into 4 rotation groups (~25 each for timeout safety)
const GROUPS = [
  ['NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
   'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD', 'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC', 'SOFI', 'HOOD', 'PSFE'],
  ['WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'QS', 'SIRI', 'NOK', 'BB',
   'TELL', 'CLOV', 'ASTS', 'RKLB', 'LUNR', 'RGTI', 'QUBT', 'BTG', 'FSM', 'GPL', 'GATO', 'USAS', 'MARA', 'RIOT', 'BITF'],
  ['HUT', 'CLSK', 'AFRM', 'BKKT', 'CENN', 'EVGO', 'GSAT', 'HIMS', 'IBRX', 'JOBY',
   'KULR', 'LIDR', 'MVIS', 'NNDM', 'ORGN', 'PAYO', 'QBTS', 'RDW', 'STEM', 'TPIC', 'UEC', 'VLD', 'WULF', 'XOS', 'YEXT'],
  ['ZETA', 'AEVA', 'AMPX', 'ARVL', 'BEEM', 'BLNK', 'CANO', 'DM', 'EOSE', 'FLNC',
   'GLS', 'HYLN', 'KORE', 'LAZR', 'MAPS', 'NUVB', 'OUST', 'SHLS', 'TRMR', 'UPST', 'VNET', 'WRAP', 'XPEV', 'ARQQ', 'ENVX'],
];

// 4-group rotation: scan ~25 tickers per call (~8s), merge all cached groups
let rotationIndex = 0;
const cachedGroups: any[][] = [[], [], [], []];
let lastResponseCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 25000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'scan' || action === 'top10' || action === 'top50') {
      // Return cached if fresh
      if (lastResponseCache && Date.now() - lastResponseCache.timestamp < CACHE_TTL_MS) {
        return new Response(JSON.stringify(lastResponseCache.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Scan one group per call (~25 tickers, ~8s safe)
      const groupIdx = rotationIndex % GROUPS.length;
      const tickers = GROUPS[groupIdx];
      rotationIndex++;

      const freshQuotes: any[] = [];

      for (const sym of tickers) {
        try {
          await new Promise(r => setTimeout(r, 300));
          const quote = await finnhubFetch(`/quote?symbol=${sym}`);
          const price = quote.c;
          if (!price || price <= 0 || price >= 10) continue;

          const changePct = quote.dp || 0;
          const changeScore = Math.min(Math.max(changePct, 0) * 5, 70);
          const priceScore = price < 1 ? 20 : price < 3 ? 15 : price < 5 ? 10 : 5;
          const compositeScore = +(changeScore + priceScore).toFixed(1);

          freshQuotes.push({
            symbol: sym,
            shortName: sym,
            regularMarketPrice: price,
            regularMarketChange: quote.d || 0,
            regularMarketChangePercent: changePct,
            regularMarketVolume: 0,
            averageDailyVolume10Day: 0,
            volumeSurge: 0,
            isVolumeSurge: false,
            isHot: changePct >= 20,
            previousClose: quote.pc,
            dayHigh: quote.h,
            dayLow: quote.l,
            compositeScore,
          });
        } catch (e: any) {
          if (e.message === 'Finnhub rate limit') {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      // Update this group's cache
      cachedGroups[groupIdx] = freshQuotes;

      // Merge all groups, sort, take top 50
      const allQuotes = cachedGroups.flat();
      allQuotes.sort((a, b) => b.compositeScore - a.compositeScore);
      const top50 = allQuotes.slice(0, 50);

      const result = {
        stocks: top50,
        total: top50.length,
        allScanned: allQuotes.length,
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
