import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Known penny stock tickers (actively traded US penny stocks)
const PENNY_STOCK_TICKERS = [
  'SIRI', 'TELL', 'CLOV', 'SOFI', 'PLTR', 'NIO', 'LCID', 'RIVN',
  'WISH', 'BB', 'NOK', 'SENS', 'GNUS', 'NAKD', 'CTRM', 'ZOM',
  'SNDL', 'BNGO', 'IDEX', 'FCEL', 'PLUG', 'WKHS', 'RIDE', 'NKLA',
  'SKLZ', 'CLVS', 'MNMD', 'TLRY', 'ACB', 'CGC', 'GRPN', 'DNA',
  'OPEN', 'VLD', 'PSFE', 'BARK', 'SDC', 'BODY', 'ME', 'ASTS',
  'IONQ', 'AFRM', 'PATH', 'DKNG', 'HOOD', 'MVST', 'QS', 'CHPT',
  'GOEV', 'FFIE', 'MULN', 'HYMC', 'BBIG', 'ATER', 'PROG', 'PHUN',
  'DWAC', 'RDBX', 'REV', 'APRN', 'WEBR', 'BYND', 'LMND', 'COIN',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, minPrice = 0.7, maxPrice = 1.5, volumeMultiplier = 2.0 } = await req.json();

    if (action === 'scan') {
      // Fetch quotes for all penny stock candidates in batches
      const batchSize = 20;
      const allQuotes: any[] = [];
      
      for (let i = 0; i < PENNY_STOCK_TICKERS.length; i += batchSize) {
        const batch = PENNY_STOCK_TICKERS.slice(i, i + batchSize);
        const symbolsStr = batch.join(',');
        
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${batch[0]}?interval=1d&range=5d`;
          // Use v7 quote for batch
          const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsStr}`;
          const response = await fetch(quoteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          
          if (response.ok) {
            const data = await response.json();
            const quotes = data.quoteResponse?.result || [];
            allQuotes.push(...quotes);
          } else {
            // Fallback: fetch individually via chart API
            for (const s of batch) {
              try {
                const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=5d`;
                const fallbackRes = await fetch(fallbackUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (fallbackRes.ok) {
                  const data = await fallbackRes.json();
                  const result = data.chart?.result?.[0];
                  if (result) {
                    const meta = result.meta;
                    const volumes = result.indicators?.quote?.[0]?.volume || [];
                    const avgVolume = volumes.slice(0, -1).reduce((a: number, b: number) => a + (b || 0), 0) / Math.max(volumes.length - 1, 1);
                    const lastVolume = volumes[volumes.length - 1] || 0;
                    allQuotes.push({
                      symbol: s,
                      shortName: meta.shortName || s,
                      regularMarketPrice: meta.regularMarketPrice,
                      regularMarketChange: meta.regularMarketPrice - meta.chartPreviousClose,
                      regularMarketChangePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
                      regularMarketVolume: lastVolume,
                      averageDailyVolume10Day: avgVolume,
                      marketCap: 0,
                    });
                  }
                }
              } catch { /* skip */ }
            }
          }
        } catch { /* skip batch */ }
      }

      // Filter by price range
      const filtered = allQuotes.filter((q: any) => {
        const price = q.regularMarketPrice || 0;
        return price >= minPrice && price <= maxPrice;
      });

      // Calculate volume surge and sort
      const withSurge = filtered.map((q: any) => {
        const currentVol = q.regularMarketVolume || 0;
        const avgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || 1;
        const volumeSurge = avgVol > 0 ? currentVol / avgVol : 0;
        return { ...q, volumeSurge, isVolumeSurge: volumeSurge >= volumeMultiplier };
      });

      // Sort: volume surge stocks first, then by volume surge ratio
      withSurge.sort((a: any, b: any) => {
        if (a.isVolumeSurge && !b.isVolumeSurge) return -1;
        if (!a.isVolumeSurge && b.isVolumeSurge) return 1;
        return (b.volumeSurge || 0) - (a.volumeSurge || 0);
      });

      return new Response(JSON.stringify({ stocks: withSurge, total: withSurge.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Penny stocks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
