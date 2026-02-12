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
    const text = await res.text();
    throw new Error(`Finnhub error ${res.status}: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, symbols } = await req.json();

    if (action === 'quote') {
      const tickerList: string[] = symbols || [symbol];
      const quotes = await Promise.all(
        tickerList.map(async (s: string) => {
          try {
            const q = await finnhubFetch(`/quote?symbol=${encodeURIComponent(s)}`);
            return {
              symbol: s,
              shortName: s,
              regularMarketPrice: q.c,
              regularMarketChange: q.d,
              regularMarketChangePercent: q.dp,
              regularMarketVolume: 0, // quote endpoint doesn't return volume
              marketCap: 0,
              fiftyTwoWeekHigh: q.h, // day high as proxy
              fiftyTwoWeekLow: q.l,  // day low as proxy
              previousClose: q.pc,
              dayHigh: q.h,
              dayLow: q.l,
              openPrice: q.o,
            };
          } catch {
            return { symbol: s, shortName: s, regularMarketPrice: 0, regularMarketChange: 0, regularMarketChangePercent: 0, regularMarketVolume: 0, marketCap: 0, fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0 };
          }
        })
      );
      return new Response(JSON.stringify({ quotes }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'chart') {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 90 * 86400; // 3 months
      const data = await finnhubFetch(`/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}`);
      
      if (data.s === 'no_data' || !data.t) {
        throw new Error('No chart data available');
      }

      const chartData = data.t.map((t: number, i: number) => ({
        date: new Date(t * 1000).toISOString().split('T')[0],
        timestamp: t,
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
      }));

      return new Response(JSON.stringify({
        chartData,
        meta: { symbol, regularMarketPrice: data.c[data.c.length - 1] }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'search') {
      const query = symbol;
      const data = await finnhubFetch(`/search?q=${encodeURIComponent(query)}`);
      const results = (data.result || []).map((r: any) => ({
        symbol: r.symbol,
        shortname: r.description,
        exchange: r.displaySymbol,
        type: r.type,
      }));
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'company-news') {
      const to = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const news = await finnhubFetch(`/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${to}`);
      return new Response(JSON.stringify({ news: (news || []).slice(0, 20) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'basic-financials') {
      const data = await finnhubFetch(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'sec-filings') {
      const data = await finnhubFetch(`/stock/filings?symbol=${encodeURIComponent(symbol)}`);
      return new Response(JSON.stringify({ filings: (data || []).slice(0, 20) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'peers') {
      const data = await finnhubFetch(`/stock/peers?symbol=${encodeURIComponent(symbol)}`);
      return new Response(JSON.stringify({ peers: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Stock data error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
