import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Yahoo Finance API proxy
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, symbols } = await req.json();

    if (action === 'quote') {
      // Get real-time quote for single or multiple symbols
      const tickerList = symbols || [symbol];
      const symbolsStr = tickerList.join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsStr}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        // Fallback to v6 API
        const quotes = [];
        for (const s of tickerList) {
          try {
            const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=1d`;
            const fallbackRes = await fetch(fallbackUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (fallbackRes.ok) {
              const data = await fallbackRes.json();
              const result = data.chart?.result?.[0];
              if (result) {
                const meta = result.meta;
                quotes.push({
                  symbol: s,
                  shortName: s,
                  regularMarketPrice: meta.regularMarketPrice,
                  regularMarketChange: meta.regularMarketPrice - meta.chartPreviousClose,
                  regularMarketChangePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
                  regularMarketVolume: result.indicators?.quote?.[0]?.volume?.slice(-1)?.[0] || 0,
                  marketCap: 0,
                  fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || meta.regularMarketPrice * 1.3,
                  fiftyTwoWeekLow: meta.fiftyTwoWeekLow || meta.regularMarketPrice * 0.7,
                });
              }
            }
          } catch { /* skip */ }
        }
        return new Response(JSON.stringify({ quotes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const data = await response.json();
      const quotes = data.quoteResponse?.result || [];
      
      return new Response(JSON.stringify({ quotes }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'chart') {
      // Get historical chart data
      const range = symbol === '^VIX' ? '5d' : '3mo';
      const interval = symbol === '^VIX' ? '1d' : '1d';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) {
        throw new Error('No chart data available');
      }
      
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      
      const chartData = timestamps.map((t: number, i: number) => ({
        date: new Date(t * 1000).toISOString().split('T')[0],
        timestamp: t,
        open: quote.open?.[i],
        high: quote.high?.[i],
        low: quote.low?.[i],
        close: quote.close?.[i],
        volume: quote.volume?.[i],
      })).filter((d: any) => d.close !== null && d.close !== undefined);
      
      return new Response(JSON.stringify({ 
        chartData,
        meta: result.meta 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'search') {
      const query = symbol;
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      return new Response(JSON.stringify({ results: data.quotes || [] }), {
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
