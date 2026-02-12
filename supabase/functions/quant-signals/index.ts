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

// ===== Technical Indicator Helpers =====
function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const atr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    atr.push(i < period ? (atr[i - 1] * i + tr) / (i + 1) : (atr[i - 1] * (period - 1) + tr) / period);
  }
  return atr;
}

function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumPV = 0, cumV = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * (volumes[i] || 1);
    cumV += volumes[i] || 1;
  }
  return cumV > 0 ? cumPV / cumV : closes[closes.length - 1];
}

// ===== 10 Indicator Scoring Functions =====

// 01. Event-Driven Sentiment Intelligence
async function scoreSentiment(symbol: string): Promise<{ score: number; details: string }> {
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const news = await finnhubFetch(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
    if (!news || news.length === 0) return { score: 5, details: '뉴스 없음 (중립)' };

    const positiveKw = ['surge', 'exceed', 'approval', 'breakthrough', 'beat', 'upgrade', 'record', 'soar', 'rally', 'buy'];
    const negativeKw = ['miss', 'delay', 'lawsuit', 'downgrade', 'decline', 'loss', 'warning', 'cut', 'crash', 'sell'];

    let sentimentSum = 0;
    const headlines = news.slice(0, 10);
    for (const n of headlines) {
      const text = (n.headline || '').toLowerCase();
      let s = 0;
      for (const kw of positiveKw) if (text.includes(kw)) s += 0.2;
      for (const kw of negativeKw) if (text.includes(kw)) s -= 0.2;
      sentimentSum += Math.max(-1, Math.min(1, s));
    }
    const avgSentiment = sentimentSum / headlines.length; // -1 to +1

    // SEC Filing bonus
    try {
      const filings = await finnhubFetch(`/stock/filings?symbol=${symbol}`);
      const recentFilings = (filings || []).slice(0, 5);
      const has8K = recentFilings.some((f: any) => f.form === '8-K');
      const hasForm4 = recentFilings.some((f: any) => f.form === '4');
      if (has8K || hasForm4) {
        const bonus = (has8K ? 1 : 0) + (hasForm4 ? 1 : 0);
        const filingScore = Math.min(10, Math.round((avgSentiment + 1) * 5 * 2.5 * bonus / 2));
        return { score: Math.max(0, Math.min(10, filingScore)), details: `SEC Filing(${has8K ? '8-K' : ''}${hasForm4 ? ',Form4' : ''}) 감지, 가중치 2.5x` };
      }
    } catch { /* no filings data */ }

    const score = Math.round((avgSentiment + 1) * 5); // 0-10
    return { score: Math.max(0, Math.min(10, score)), details: `감성점수: ${avgSentiment.toFixed(2)}, 뉴스 ${headlines.length}건` };
  } catch {
    return { score: 5, details: '분석 불가' };
  }
}

// 02. RVOL (Relative Volume)
function scoreRVOL(volumes: number[]): { score: number; details: string; rvol: number } {
  if (volumes.length < 21) return { score: 0, details: '데이터 부족', rvol: 0 };
  const currentVol = volumes[volumes.length - 1];
  const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const rvol = avgVol > 0 ? currentVol / avgVol : 0;

  // Z-Score
  const mean = avgVol;
  const variance = volumes.slice(-21, -1).reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
  const std = Math.sqrt(variance);
  const zScore = std > 0 ? (currentVol - mean) / std : 0;

  let score = 0;
  if (rvol >= 3.0 && zScore >= 2.0) score = 10;
  else if (rvol >= 2.5) score = 8;
  else if (rvol >= 2.0) score = 6;
  else if (rvol >= 1.5) score = 4;
  else if (rvol >= 1.0) score = 2;

  return { score, details: `RVOL: ${rvol.toFixed(1)}x, Z-Score: ${zScore.toFixed(2)}`, rvol };
}

// 03. Candle/EMA Pattern (Triple Confirm)
function scoreCandlePattern(closes: number[], highs: number[], lows: number[], volumes: number[]): { score: number; details: string } {
  if (closes.length < 30) return { score: 0, details: '데이터 부족' };
  const n = closes.length - 1;
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));

  let confirms = 0;
  const reasons: string[] = [];

  // VWAP Cross: price crosses above VWAP
  if (closes[n] > vwap && closes[n - 1] <= vwap) { confirms++; reasons.push('VWAP 상향 돌파'); }
  else if (closes[n] > vwap) { confirms += 0.5; reasons.push('VWAP 상단 유지'); }

  // EMA 9/21 Pullback: price near EMA9 support + tail
  const distToEma9 = Math.abs(closes[n] - ema9[n]) / closes[n];
  if (distToEma9 < 0.02 && closes[n] > ema9[n] && lows[n] < ema9[n]) { confirms++; reasons.push('EMA9 지지 + 꼬리'); }
  else if (ema9[n] > ema21[n] && closes[n] > ema9[n]) { confirms += 0.5; reasons.push('EMA9>21 정배열'); }

  // RSI Momentum: RSI above 40, uptrending, below 70
  const currentRSI = rsi[n];
  if (currentRSI > 40 && currentRSI < 70 && rsi[n] > rsi[n - 1]) { confirms++; reasons.push(`RSI ${currentRSI.toFixed(0)} 우상향`); }

  const score = confirms >= 3 ? 10 : confirms >= 2 ? 7 : confirms >= 1 ? 4 : 1;
  return { score, details: reasons.join(', ') || '조건 미충족' };
}

// 04. ATR Adaptive Volatility
function scoreATR(highs: number[], lows: number[], closes: number[]): { score: number; details: string; trailingStop: number } {
  if (closes.length < 20) return { score: 0, details: '데이터 부족', trailingStop: 0 };
  const atr = calculateATR(highs, lows, closes, 14);
  const currentATR = atr[atr.length - 1];
  const prevATR = atr.slice(-5, -1).reduce((a, b) => a + b, 0) / 4;
  const n = closes.length - 1;

  // Keltner Channel upper = EMA20 + 2*ATR
  const ema20 = calculateEMA(closes, 20);
  const keltnerUpper = ema20[n] + 2 * currentATR;
  const priceAboveKeltner = closes[n] > keltnerUpper;

  // Trailing stop = recent high - 2.0 * ATR
  const recentHigh = Math.max(...highs.slice(-10));
  const trailingStop = +(recentHigh - 2.0 * currentATR).toFixed(4);

  let score = 0;
  if (currentATR < prevATR * 0.8) { score = 2; } // Low volatility, block entry
  else if (priceAboveKeltner) { score = 10; }
  else if (closes[n] > ema20[n] + currentATR) { score = 7; }
  else { score = 4; }

  return { score, details: `ATR: ${currentATR.toFixed(4)}, Keltner돌파: ${priceAboveKeltner ? 'O' : 'X'}`, trailingStop };
}

// 05. Gap Analysis
function scoreGap(opens: number[], closes: number[], highs: number[], lows: number[], volumes: number[]): { score: number; details: string } {
  if (closes.length < 5) return { score: 0, details: '데이터 부족' };
  const n = closes.length - 1;
  const prevClose = closes[n - 1];
  const gapPct = ((opens[n] - prevClose) / prevClose) * 100;

  let score = 0;
  const reasons: string[] = [];

  if (gapPct >= 4 && gapPct <= 15) {
    score += 5;
    reasons.push(`갭 상승 ${gapPct.toFixed(1)}% (적정 범위)`);

    // ORB: first candle high breakout (simplified: current close > open high)
    if (closes[n] > opens[n] && volumes[n] > volumes[n - 1]) {
      score += 5;
      reasons.push('ORB 돌파 확인');
    }
  } else if (gapPct > 15) {
    score = 2;
    reasons.push(`갭 과다 ${gapPct.toFixed(1)}% (>15% 제외)`);
  } else if (gapPct > 0) {
    score = 3;
    reasons.push(`소폭 갭 ${gapPct.toFixed(1)}%`);
  } else {
    score = 1;
    reasons.push(`갭 하락 ${gapPct.toFixed(1)}%`);
  }

  return { score: Math.min(10, score), details: reasons.join(', ') };
}

// 06. Short Squeeze (simulated - Finnhub free doesn't have detailed short data)
function scoreShortSqueeze(closes: number[], volumes: number[]): { score: number; details: string } {
  if (closes.length < 21) return { score: 0, details: '데이터 부족' };
  const n = closes.length - 1;
  const high20 = Math.max(...closes.slice(-20));

  let score = 0;
  const reasons: string[] = [];

  // Squeeze Trigger: price breaks 20-day high
  if (closes[n] >= high20) {
    score += 6;
    reasons.push('20일 최고가 돌파');
  }

  // Volume confirmation
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = avgVol > 0 ? volumes[n] / avgVol : 0;
  if (volRatio > 2) {
    score += 4;
    reasons.push(`거래량 ${volRatio.toFixed(1)}x 급증`);
  }

  return { score: Math.min(10, score), details: reasons.join(', ') || 'Squeeze 신호 없음' };
}

// 07. Price Position (Blue Sky / Liquidity Void)
function scorePricePosition(closes: number[], highs: number[]): { score: number; details: string } {
  if (closes.length < 30) return { score: 0, details: '데이터 부족' };
  const n = closes.length - 1;
  const allTimeHigh = Math.max(...highs);
  const distToATH = ((allTimeHigh - closes[n]) / allTimeHigh) * 100;

  let score = 0;
  if (distToATH <= 5) { score = 10; } // Within 5% of ATH = Blue Sky
  else if (distToATH <= 10) { score = 7; }
  else if (distToATH <= 20) { score = 4; }
  else { score = 2; }

  return { score, details: `ATH 대비 ${distToATH.toFixed(1)}% 하단` };
}

// 08. Sector Synergy (RS vs SPY)
async function scoreSectorSynergy(symbol: string, symbolChange: number): Promise<{ score: number; details: string }> {
  try {
    const spyQuote = await finnhubFetch(`/quote?symbol=SPY`);
    const spyChange = spyQuote.dp || 0;

    const rs = spyChange !== 0 ? symbolChange / spyChange : 0;
    let score = 0;
    if (rs >= 3) score = 10;
    else if (rs >= 2) score = 8;
    else if (rs >= 1.5) score = 6;
    else if (rs >= 1) score = 4;
    else score = 2;

    // Peer synergy check
    let peerSynergy = false;
    try {
      const peers = await finnhubFetch(`/stock/peers?symbol=${symbol}`);
      if (peers && peers.length > 0) {
        const topPeers = peers.slice(0, 5).filter((p: string) => p !== symbol);
        let risingPeers = 0;
        for (const p of topPeers.slice(0, 3)) {
          try {
            const pq = await finnhubFetch(`/quote?symbol=${p}`);
            if ((pq.dp || 0) >= 2) risingPeers++;
          } catch { /* skip */ }
        }
        if (risingPeers >= 2) { score = Math.min(10, score + 2); peerSynergy = true; }
      }
    } catch { /* no peers */ }

    return { score, details: `RS: ${rs.toFixed(2)}x SPY${peerSynergy ? ', 동종업 동반상승' : ''}` };
  } catch {
    return { score: 5, details: 'SPY 비교 불가' };
  }
}

// 09. Trade Aggression (simplified - tick data unavailable)
function scoreTradeAggression(volumes: number[], closes: number[], opens: number[]): { score: number; details: string } {
  if (closes.length < 5) return { score: 0, details: '데이터 부족' };
  // Proxy: consecutive bullish candles with increasing volume
  const n = closes.length - 1;
  let bullishCount = 0;
  let volIncreasing = 0;
  for (let i = Math.max(0, n - 4); i <= n; i++) {
    if (closes[i] > opens[i]) bullishCount++;
    if (i > 0 && volumes[i] > volumes[i - 1]) volIncreasing++;
  }

  const aggression = (bullishCount / 5) * 100;
  let score = 0;
  if (aggression >= 80 && volIncreasing >= 3) score = 10;
  else if (aggression >= 60) score = 7;
  else if (aggression >= 40) score = 4;
  else score = 2;

  return { score, details: `매수 강도: ${aggression.toFixed(0)}%, 거래량 증가: ${volIncreasing}일` };
}

// 10. Pre-Market Catalyst (simplified)
function scorePreMarket(volumes: number[], closes: number[], highs: number[]): { score: number; details: string } {
  if (volumes.length < 5) return { score: 0, details: '데이터 부족' };
  const n = volumes.length - 1;
  const avgDailyVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 20);

  // Proxy: if today's volume is already 10%+ of avg early in the day
  const volRatio = avgDailyVol > 0 ? volumes[n] / avgDailyVol : 0;
  const breakingHigh = closes[n] > Math.max(...highs.slice(-5, -1));

  let score = 0;
  if (volRatio > 0.1 && breakingHigh) { score = 10; }
  else if (volRatio > 0.1) { score = 6; }
  else if (breakingHigh) { score = 4; }
  else { score = 2; }

  return { score, details: `Vol비율: ${(volRatio * 100).toFixed(0)}%, 고점돌파: ${breakingHigh ? 'O' : 'X'}` };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbols } = await req.json();

    if (action === 'analyze') {
      // Analyze a list of symbols and return scored recommendations
      const targetSymbols: string[] = symbols || ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'NFLX', 'CRM', 'PLTR', 'SOFI', 'NIO', 'COIN', 'HOOD', 'DKNG', 'RIVN', 'LCID', 'IONQ', 'AFRM'];

      const results: any[] = [];

      for (const sym of targetSymbols.slice(0, 15)) {
        try {
          // Fetch candle data
          const to = Math.floor(Date.now() / 1000);
          const from = to - 60 * 86400;
          const candles = await finnhubFetch(`/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}`);
          if (candles.s === 'no_data' || !candles.t) continue;

          const closes = candles.c;
          const highs = candles.h;
          const lows = candles.l;
          const opens = candles.o;
          const volumes = candles.v;
          const n = closes.length - 1;

          // Get quote for change%
          const quote = await finnhubFetch(`/quote?symbol=${sym}`);
          const changePct = quote.dp || 0;

          // Calculate all 10 indicators
          const [sentiment, sectorSynergy] = await Promise.all([
            scoreSentiment(sym),
            scoreSectorSynergy(sym, changePct),
          ]);

          const rvol = scoreRVOL(volumes);
          const candle = scoreCandlePattern(closes, highs, lows, volumes);
          const atr = scoreATR(highs, lows, closes);
          const gap = scoreGap(opens, closes, highs, lows, volumes);
          const squeeze = scoreShortSqueeze(closes, volumes);
          const position = scorePricePosition(closes, highs);
          const aggression = scoreTradeAggression(volumes, closes, opens);
          const preMarket = scorePreMarket(volumes, closes, highs);

          const indicators = {
            sentiment,
            rvol,
            candle,
            atr,
            gap,
            squeeze,
            position,
            sectorSynergy,
            aggression,
            preMarket,
          };

          const totalScore = sentiment.score + rvol.score + candle.score + atr.score +
            gap.score + squeeze.score + position.score + sectorSynergy.score +
            aggression.score + preMarket.score;

          results.push({
            symbol: sym,
            price: quote.c,
            change: quote.d,
            changePct,
            totalScore,
            indicators,
            trailingStop: atr.trailingStop,
          });
        } catch (e) {
          console.error(`Error analyzing ${sym}:`, e);
        }
      }

      // Sort by total score descending, return top 10
      results.sort((a, b) => b.totalScore - a.totalScore);

      return new Response(JSON.stringify({ recommendations: results.slice(0, 10) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Quant signals error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
