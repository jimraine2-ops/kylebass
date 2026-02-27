const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cache exchange rate for 60 seconds
let cachedRate: { rate: number; ts: number } | null = null;
const CACHE_TTL = 60000;
async function fetchExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.ts < CACHE_TTL) {
    return cachedRate.rate;
  }

  // Try multiple free exchange rate APIs in order
  const sources = [
    async () => {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.rates?.KRW;
    },
    async () => {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.rates?.KRW;
    },
    async () => {
      // Fallback: Twelve Data forex quote
      const token = Deno.env.get('TWELVE_DATA_API_KEY');
      if (!token) throw new Error('No TWELVE_DATA_API_KEY');
      const res = await fetch(`https://api.twelvedata.com/exchange_rate?symbol=USD/KRW&apikey=${token}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return parseFloat(data.rate);
    },
  ];

  for (const source of sources) {
    try {
      const rate = await source();
      if (rate && rate > 1000 && rate < 2000) {
        cachedRate = { rate, ts: Date.now() };
        console.log(`Exchange rate fetched: ${rate} KRW/USD`);
        return rate;
      }
    } catch (e) {
      console.warn('Exchange rate source failed:', e);
    }
  }

  // Ultimate fallback
  console.warn('All exchange rate sources failed, using fallback 1,380');
  return 1380;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rate = await fetchExchangeRate();
    return new Response(JSON.stringify({
      rate,
      currency: 'KRW',
      base: 'USD',
      timestamp: Date.now(),
      cached: cachedRate ? (Date.now() - cachedRate.ts < 1000 ? false : true) : false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, rate: 1380 }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
