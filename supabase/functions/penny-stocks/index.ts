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
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

// Under $10 stock candidates pool
const UNDER10_TICKERS = [
  'SIRI', 'TELL', 'CLOV', 'SOFI', 'NIO', 'LCID',
  'WISH', 'BB', 'NOK', 'SENS', 'GNUS', 'SNDL',
  'BNGO', 'IDEX', 'FCEL', 'PLUG', 'WKHS', 'NKLA',
  'SKLZ', 'CLVS', 'MNMD', 'TLRY', 'ACB', 'CGC',
  'DNA', 'OPEN', 'PSFE', 'SDC', 'ME', 'ASTS',
  'IONQ', 'HOOD', 'QS', 'CHPT', 'GOEV', 'FFIE',
  'MULN', 'BYND', 'LMND',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'scan' || action === 'top10') {
      const allQuotes: any[] = [];

      for (const sym of UNDER10_TICKERS.slice(0, 20)) {
        try {
          // Delay between requests to avoid Finnhub 429 rate limit
          await new Promise(r => setTimeout(r, 300));

          const quote = await finnhubFetch(`/quote?symbol=${sym}`);
          const price = quote.c;
          if (!price || price >= 10) continue;

          // Delay before candle request
          await new Promise(r => setTimeout(r, 300));

          let avgVol = 0;
          let currentVol = 0;
          try {
            const candles = await finnhubFetch(`/stock/candle?symbol=${sym}&resolution=D&from=${Math.floor(Date.now() / 1000) - 30 * 86400}&to=${Math.floor(Date.now() / 1000)}`);
            if (candles.s !== 'no_data' && candles.v) {
              currentVol = candles.v[candles.v.length - 1] || 0;
              const pastVols = candles.v.slice(0, -1);
              avgVol = pastVols.length > 0 ? pastVols.reduce((a: number, b: number) => a + b, 0) / pastVols.length : 0;
            }
          } catch { /* skip candle errors */ }

          const volumeSurge = avgVol > 0 ? currentVol / avgVol : 0;
          const changePct = quote.dp || 0;

          const volScore = Math.min(volumeSurge * 20, 60);
          const changeScore = Math.min(Math.max(changePct, 0) * 4, 40);
          const compositeScore = +(volScore + changeScore).toFixed(1);

          allQuotes.push({
            symbol: sym,
            shortName: sym,
            regularMarketPrice: price,
            regularMarketChange: quote.d || 0,
            regularMarketChangePercent: changePct,
            regularMarketVolume: currentVol,
            averageDailyVolume10Day: avgVol,
            volumeSurge,
            isVolumeSurge: volumeSurge >= 2.0,
            previousClose: quote.pc,
            dayHigh: quote.h,
            dayLow: quote.l,
            compositeScore,
          });
        } catch { /* skip */ }
      }

      // Sort by composite score descending, take TOP 10
      allQuotes.sort((a, b) => b.compositeScore - a.compositeScore);
      const top10 = allQuotes.slice(0, 10);

      return new Response(JSON.stringify({ stocks: top10, total: top10.length, allScanned: allQuotes.length }), {
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
