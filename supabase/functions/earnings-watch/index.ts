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

// Simple 10-indicator scoring (lightweight version for earnings scan)
function quickScore(quote: any): number {
  if (!quote || !quote.c) return 0;
  const changePct = quote.dp || 0;
  let score = 0;
  // Sentiment
  score += changePct >= 5 ? 9 : changePct >= 3 ? 7 : changePct >= 1 ? 5 : changePct >= -1 ? 4 : 2;
  // Price momentum
  if (quote.c > quote.pc) score += 7;
  else score += 3;
  // Simplified total (0-100 scale approximation)
  return Math.round((score / 16) * 100);
}

// Win probability calculator (same as cloud-agent)
function getWinProbability(score: number): number {
  if (score >= 80) return 98;
  if (score >= 75) return 95;
  if (score >= 70) return 90;
  if (score >= 65) return 85;
  if (score >= 60) return 80;
  if (score >= 55) return 75;
  if (score >= 50) return 60;
  if (score >= 45) return 45;
  if (score >= 40) return 30;
  return 15;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = getToken();
    if (!token) {
      return new Response(JSON.stringify({ error: 'No API key' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get earnings calendar for next 3 days
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0];
    const toDate = new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0];

    const earningsData = await finnhubFetch(`/calendar/earnings?from=${fromDate}&to=${toDate}`);
    if (!earningsData || !earningsData.earningsCalendar) {
      return new Response(JSON.stringify({ stocks: [], fromDate, toDate, error: 'No earnings data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const earningsEntries = earningsData.earningsCalendar || [];

    // Filter and enrich with quotes
    const results: any[] = [];
    const processed = new Set<string>();

    // Process in batches of 5
    for (let i = 0; i < earningsEntries.length; i += 5) {
      const batch = earningsEntries.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(async (entry: any) => {
        const symbol = entry.symbol;
        if (!symbol || processed.has(symbol)) return null;
        processed.add(symbol);

        try {
          const quote = await finnhubFetch(`/quote?symbol=${symbol}`);
          if (!quote || !quote.c || quote.c <= 0) return null;

          const priceKRW = quote.c * KRW_RATE;
          // Filter: only sub-₩12,000 stocks
          if (quote.c > MAX_PRICE_USD) return null;

          const score = quickScore(quote);
          const winProb = getWinProbability(score);
          const changePct = quote.dp || 0;

          return {
            symbol,
            date: entry.date,
            hour: entry.hour || 'unknown', // bmo (before market open), amc (after market close)
            epsEstimate: entry.epsEstimate,
            epsActual: entry.epsActual,
            revenueEstimate: entry.revenueEstimate,
            revenueActual: entry.revenueActual,
            quarter: entry.quarter,
            year: entry.year,
            price: quote.c,
            priceKRW: Math.round(priceKRW),
            previousClose: quote.pc,
            changePct: +changePct.toFixed(2),
            change: +(quote.c - quote.pc).toFixed(4),
            high: quote.h,
            low: quote.l,
            volume: quote.v || 0,
            quantScore: score,
            winProb,
            isPreBuy: score >= 60 && winProb >= 88,
            isHot: changePct >= 10,
            isSurging: changePct >= 5,
          };
        } catch { return null; }
      }));

      for (const r of batchResults) {
        if (r) results.push(r);
      }

      // Rate limit protection
      if (i + 5 < earningsEntries.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Sort by date, then by score descending
    results.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return b.quantScore - a.quantScore;
    });

    return new Response(JSON.stringify({
      stocks: results,
      fromDate,
      toDate,
      totalEarnings: earningsEntries.length,
      filteredCount: results.length,
      timestamp: now.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
