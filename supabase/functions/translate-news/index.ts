import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { installCostGuard } from "../_shared/cost-guard.ts";

// ★ [후불 0원 정책] 부팅 즉시 유료 LLM/AI 호출 차단 가드 설치
installCostGuard();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// ★★★ [No-Cost Policy] LLM 호출 완전 제거
// 정책: Core 룰 "No LLM inference for trading" + 무료 API만 사용
// 이전: Lovable AI Gateway (google/gemini-2.5-flash-lite) → 후불 청구 위험
// 이후: 결정론적 사전 기반 단어 치환만 수행 (비용 0)
// ============================================================

// 금융 전문 용어 매핑 사전 (영→한)
const FINANCE_TERMS: Record<string, string> = {
  'bullish': '강세', 'bearish': '약세',
  'hawkish': '매파적', 'dovish': '비둘기파적',
  'rally': '랠리(급등)', 'surge': '급등', 'plunge': '급락',
  'soar': '급등', 'tumble': '급락', 'jump': '급등', 'slump': '급락',
  'earnings': '실적', 'revenue': '매출', 'profit': '이익', 'loss': '손실',
  'guidance': '가이던스(실적 전망)', 'beat': '상회', 'miss': '하회',
  'upgrade': '목표가 상향', 'downgrade': '목표가 하향',
  'outperform': '시장 대비 우수', 'underperform': '시장 대비 부진',
  'buy': '매수', 'sell': '매도', 'hold': '보유',
  'IPO': '기업공개(IPO)', 'SEC filing': 'SEC 공시',
  'insider trading': '내부자 거래', 'short squeeze': '숏스퀴즈',
  'market cap': '시가총액', 'dividend': '배당금',
  'stock split': '주식분할', 'buyback': '자사주 매입',
  'merger': '합병', 'acquisition': '인수',
  'layoff': '감원', 'restructuring': '구조조정', 'bankruptcy': '파산',
  'Fed': '연준(Fed)', 'CPI': '소비자물가지수(CPI)', 'GDP': '국내총생산(GDP)',
  'interest rate': '금리', 'inflation': '인플레이션',
  'recession': '경기침체', 'yield': '수익률',
  'bond': '채권', 'treasury': '국채',
};

// 주요 기업명 매핑
const COMPANY_TERMS: Record<string, string> = {
  'Apple': '애플', 'Microsoft': '마이크로소프트', 'Tesla': '테슬라',
  'NVIDIA': '엔비디아', 'Nvidia': '엔비디아', 'Amazon': '아마존',
  'Google': '구글', 'Alphabet': '알파벳', 'Meta': '메타', 'Facebook': '메타',
  'Netflix': '넷플릭스', 'Intel': '인텔', 'AMD': 'AMD', 'Boeing': '보잉',
};

function applyDictionary(text: string): string {
  if (!text) return text;
  let out = text;
  // 긴 문자열부터 치환 (부분 매치 방지)
  const all = [...Object.entries(COMPANY_TERMS), ...Object.entries(FINANCE_TERMS)]
    .sort((a, b) => b[0].length - a[0].length);
  for (const [en, ko] of all) {
    const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    out = out.replace(re, ko);
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articles } = await req.json();

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({ translated: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 결정론적 사전 기반 치환 (LLM 호출 없음, 비용 0)
    const translated = articles.map((a: any) => ({
      ...a,
      headline_ko: applyDictionary(a.headline || ''),
      summary_ko: applyDictionary(a.summary || ''),
    }));

    return new Response(JSON.stringify({ translated, mode: 'dictionary-only' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('translate-news error:', error);
    return new Response(JSON.stringify({ translated: [], error: String(error) }), {
      status: 200, // 에러여도 클라이언트는 원문으로 폴백 가능하도록
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
