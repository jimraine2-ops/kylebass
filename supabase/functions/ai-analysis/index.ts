import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { action, symbol, chartData, newsHeadlines } = await req.json();

    if (action === 'technical-analysis') {
      // Calculate technical indicators from chart data
      const closes = chartData.map((d: any) => d.close).filter(Boolean);
      const volumes = chartData.map((d: any) => d.volume).filter(Boolean);
      
      // RSI calculation
      const rsi = calculateRSI(closes, 14);
      
      // MACD calculation
      const macd = calculateMACD(closes);
      
      // Moving averages
      const ma5 = calculateMA(closes, 5);
      const ma20 = calculateMA(closes, 20);
      const ma60 = calculateMA(closes, 60);
      const ma200 = calculateMA(closes, 200);
      
      // Average volume
      const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / Math.min(volumes.length, 20);
      const currentVolume = volumes[volumes.length - 1] || 0;
      const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

      const currentPrice = closes[closes.length - 1];
      
      // AI recommendation based on indicators
      const prompt = `당신은 전문 주식 기술적 분석가입니다. 다음 기술적 지표를 기반으로 ${symbol} 종목에 대한 매매 추천을 JSON 형식으로 제공해주세요.

현재가: $${currentPrice?.toFixed(2)}
RSI(14): ${rsi?.toFixed(1)}
MACD: ${macd.macd?.toFixed(4)}, Signal: ${macd.signal?.toFixed(4)}, Histogram: ${macd.histogram?.toFixed(4)}
MA5: $${ma5?.toFixed(2)}, MA20: $${ma20?.toFixed(2)}, MA60: $${ma60?.toFixed(2) || 'N/A'}
거래량 비율 (현재/평균): ${volumeRatio?.toFixed(2)}x

다음 JSON 형식으로만 응답하세요:
{
  "recommendation": "매수" 또는 "매도" 또는 "관망",
  "confidence": 0-100 사이의 신뢰도,
  "reasons": ["이유1", "이유2", "이유3"],
  "summary": "한 줄 요약",
  "stopLoss": 추천 손절가(숫자),
  "takeProfit": 추천 익절가(숫자)
}`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('AI Gateway error:', errText);
        throw new Error('AI analysis failed');
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      // Parse JSON from AI response
      let recommendation;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        recommendation = {
          recommendation: "관망",
          confidence: 50,
          reasons: ["AI 분석 파싱 실패"],
          summary: "분석 결과를 처리할 수 없습니다.",
          stopLoss: currentPrice * 0.95,
          takeProfit: currentPrice * 1.1,
        };
      }

      return new Response(JSON.stringify({
        symbol,
        currentPrice,
        rsi,
        macd,
        ma: { ma5, ma20, ma60, ma200 },
        volumeRatio,
        recommendation,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'sentiment-analysis') {
      const prompt = `당신은 금융 뉴스 감성 분석 전문가입니다. 다음 ${symbol} 관련 뉴스 헤드라인들을 분석해주세요.

헤드라인:
${(newsHeadlines || []).map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')}

다음 JSON 형식으로만 응답하세요:
{
  "overallSentiment": "긍정" 또는 "부정" 또는 "중립",
  "sentimentScore": -100에서 100 사이의 점수,
  "positiveRatio": 0-100,
  "negativeRatio": 0-100,
  "neutralRatio": 0-100,
  "headlines": [
    {"text": "헤드라인", "sentiment": "긍정/부정/중립", "score": -100~100, "summary": "한줄 요약"}
  ],
  "warning": "악재 경고 메시지 (있을 경우)" 또는 null
}`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('Sentiment analysis failed');
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      let sentiment;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        sentiment = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        sentiment = {
          overallSentiment: "중립",
          sentimentScore: 0,
          positiveRatio: 33,
          negativeRatio: 33,
          neutralRatio: 34,
          headlines: [],
          warning: null,
        };
      }

      return new Response(JSON.stringify(sentiment), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Technical indicator calculations
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes: number[]) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  
  // Simplified signal line
  const macdValues = [];
  for (let i = Math.max(0, closes.length - 9); i < closes.length; i++) {
    const e12 = calculateEMA(closes.slice(0, i + 1), 12);
    const e26 = calculateEMA(closes.slice(0, i + 1), 26);
    macdValues.push(e12 - e26);
  }
  const signal = macdValues.reduce((a, b) => a + b, 0) / macdValues.length;
  
  return {
    macd: macdLine,
    signal,
    histogram: macdLine - signal,
  };
}

function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  if (data.length < period) return data.reduce((a, b) => a + b, 0) / data.length;
  
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
