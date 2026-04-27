// ws-token: returns a Finnhub WebSocket URL for the client.
// Uses native Deno.serve to avoid std/http boot 503 errors.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get('FINNHUB_API_KEY');
    if (!token) {
      // Graceful degrade: 200 + fallback flag so the client switches to polling
      // instead of crashing with a blank screen.
      return new Response(
        JSON.stringify({ error: 'FINNHUB_API_KEY not configured', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ wsUrl: `wss://ws.finnhub.io?token=${token}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[ws-token] error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? 'unknown', fallback: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
