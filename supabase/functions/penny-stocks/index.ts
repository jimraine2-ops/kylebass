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

// Penny stock candidates
const PENNY_TICKERS = [
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
    const { action, minPrice = 0.7, maxPrice = 1.5 } = await req.json();

    if (action === 'scan') {
      const allQuotes: any[] = [];

      // Fetch quotes individually (Finnhub doesn't have batch quote)
      // Limit to avoid rate limits (60/min free tier)
      for (const sym of PENNY_TICKERS.slice(0, 25)) {
        try {
          const [quote, candles] = await Promise.all([
            finnhubFetch(`/quote?symbol=${sym}`),
            finnhubFetch(`/stock/candle?symbol=${sym}&resolution=D&from=${Math.floor(Date.now() / 1000) - 30 * 86400}&to=${Math.floor(Date.now() / 1000)}`),
          ]);

          const price = quote.c;
          if (!price || price < minPrice || price > maxPrice) continue;

          let avgVol = 0;
          let currentVol = 0;
          if (candles.s !== 'no_data' && candles.v) {
            currentVol = candles.v[candles.v.length - 1] || 0;
            const pastVols = candles.v.slice(0, -1);
            avgVol = pastVols.length > 0 ? pastVols.reduce((a: number, b: number) => a + b, 0) / pastVols.length : 0;
          }

          const volumeSurge = avgVol > 0 ? currentVol / avgVol : 0;

          allQuotes.push({
            symbol: sym,
            shortName: sym,
            regularMarketPrice: price,
            regularMarketChange: quote.d || 0,
            regularMarketChangePercent: quote.dp || 0,
            regularMarketVolume: currentVol,
            averageDailyVolume10Day: avgVol,
            volumeSurge,
            isVolumeSurge: volumeSurge >= 2.0,
            previousClose: quote.pc,
            dayHigh: quote.h,
            dayLow: quote.l,
          });
        } catch { /* skip */ }
      }

      // Sort by volume surge
      allQuotes.sort((a, b) => {
        if (a.isVolumeSurge && !b.isVolumeSurge) return -1;
        if (!a.isVolumeSurge && b.isVolumeSurge) return 1;
        return (b.volumeSurge || 0) - (a.volumeSurge || 0);
      });

      return new Response(JSON.stringify({ stocks: allQuotes, total: allQuotes.length }), {
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
