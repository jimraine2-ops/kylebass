import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;

function getToken(): string { return Deno.env.get('FINNHUB_API_KEY') || ''; }

async function finnhubFetch(path: string) {
  const token = getToken();
  if (!token) return null;
  const sep = path.includes('?') ? '&' : '?';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${token}`);
      if (res.status === 429) {
        await res.text();
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      if (!res.ok) { await res.text(); return null; }
      return await res.json();
    } catch { /* retry */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const from = now.toISOString().split('T')[0];
    const to = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Finnhub Earnings Calendar: 48시간 이내 실적 발표 예정 종목
    const earningsData = await finnhubFetch(`/calendar/earnings?from=${from}&to=${to}`);
    
    if (!earningsData?.earningsCalendar || earningsData.earningsCalendar.length === 0) {
      return new Response(JSON.stringify({ 
        earnings: [], 
        count: 0, 
        from, to,
        message: '48시간 이내 실적 발표 예정 종목 없음' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter US stocks only, enrich with quote data for top candidates
    const usEarnings = earningsData.earningsCalendar
      .filter((e: any) => e.symbol && !e.symbol.includes('.') && e.symbol.length <= 5)
      .slice(0, 100); // Max 100

    // Fetch quotes for earnings stocks (batch 5 at a time)
    const enriched: any[] = [];
    for (let i = 0; i < Math.min(usEarnings.length, 50); i += 5) {
      const batch = usEarnings.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (e: any) => {
          const quote = await finnhubFetch(`/quote?symbol=${e.symbol}`);
          if (!quote || !quote.c) return null;
          const priceKRW = quote.c * KRW_RATE;
          return {
            symbol: e.symbol,
            date: e.date,
            hour: e.hour || 'bmo', // bmo=before market open, amc=after market close
            epsEstimate: e.epsEstimate,
            epsActual: e.epsActual,
            revenueEstimate: e.revenueEstimate,
            revenueActual: e.revenueActual,
            quarter: e.quarter,
            year: e.year,
            // Quote data
            price: quote.c,
            priceKRW: Math.round(priceKRW),
            changePct: +(quote.dp || 0).toFixed(2),
            volume: quote.v || 0,
            previousClose: quote.pc || 0,
            // Flags
            isLowPrice: priceKRW < 10000,
            hourLabel: e.hour === 'bmo' ? '장전' : e.hour === 'amc' ? '장후' : '미정',
            daysUntil: Math.ceil((new Date(e.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
          };
        })
      );
      enriched.push(...results.filter(Boolean));
      if (i + 5 < usEarnings.length) await new Promise(r => setTimeout(r, 200));
    }

    // Sort: low price first, then by changePct descending
    enriched.sort((a, b) => {
      if (a.isLowPrice !== b.isLowPrice) return a.isLowPrice ? -1 : 1;
      return Math.abs(b.changePct) - Math.abs(a.changePct);
    });

    return new Response(JSON.stringify({
      earnings: enriched,
      count: enriched.length,
      totalCalendar: usEarnings.length,
      from, to,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Earnings watch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
