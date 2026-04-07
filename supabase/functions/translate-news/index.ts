import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Financial term mappings for consistent translation
const FINANCE_TERMS: Record<string, string> = {
  'bullish': '강세',
  'bearish': '약세',
  'hawkish': '매파적',
  'dovish': '비둘기파적',
  'rally': '랠리(급등)',
  'surge': '급등',
  'plunge': '급락',
  'soar': '급등',
  'tumble': '급락',
  'earnings': '실적',
  'revenue': '매출',
  'profit': '이익',
  'loss': '손실',
  'guidance': '가이던스(실적 전망)',
  'beat': '상회',
  'miss': '하회',
  'upgrade': '목표가 상향',
  'downgrade': '목표가 하향',
  'outperform': '시장 대비 우수',
  'underperform': '시장 대비 부진',
  'buy': '매수',
  'sell': '매도',
  'hold': '보유',
  'IPO': '기업공개(IPO)',
  'SEC filing': 'SEC 공시',
  'insider trading': '내부자 거래',
  'short squeeze': '숏스퀴즈',
  'market cap': '시가총액',
  'dividend': '배당금',
  'stock split': '주식분할',
  'buyback': '자사주 매입',
  'merger': '합병',
  'acquisition': '인수',
  'layoff': '감원',
  'restructuring': '구조조정',
  'bankruptcy': '파산',
  'Fed': '연준(Fed)',
  'CPI': '소비자물가지수(CPI)',
  'GDP': '국내총생산(GDP)',
  'interest rate': '금리',
  'inflation': '인플레이션',
  'recession': '경기침체',
  'yield': '수익률',
  'bond': '채권',
  'treasury': '국채',
};

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

    // ★ [무료 전용] Lovable AI Gateway는 유료 API — 항상 로컬 번역 사용
    // LOVABLE_API_KEY가 설정되어 있어도 호출하지 않음 (후불 결제 방지)
    const USE_FREE_TRANSLATION_ONLY = true;
    const LOVABLE_API_KEY = USE_FREE_TRANSLATION_ONLY ? null : Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // 무료 로컬 번역: 금융 전문 용어 매핑으로 핵심 키워드만 번역
      const localTranslated = articles.slice(0, 20).map((a: any) => {
        let headlineKo = a.headline || '';
        let summaryKo = a.summary || '';
        for (const [en, ko] of Object.entries(FINANCE_TERMS)) {
          const regex = new RegExp(`\\b${en}\\b`, 'gi');
          headlineKo = headlineKo.replace(regex, ko);
          summaryKo = summaryKo.replace(regex, ko);
        }
        return { ...a, headline_ko: headlineKo, summary_ko: summaryKo, translated: true };
      });
      return new Response(JSON.stringify({ translated: localTranslated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch translate up to 10 articles at a time
    const batch = articles.slice(0, 10);
    const textsToTranslate = batch.map((a: any, i: number) => 
      `[${i}] 제목: ${a.headline || ''}\n요약: ${a.summary || ''}`
    ).join('\n---\n');

    const financeTermsList = Object.entries(FINANCE_TERMS)
      .map(([en, ko]) => `${en} → ${ko}`)
      .join(', ');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `당신은 금융 뉴스 전문 번역가입니다. 영문 뉴스 기사의 제목과 요약을 자연스러운 한국어로 번역하세요.

금융 전문 용어 매핑 (반드시 적용):
${financeTermsList}

규칙:
1. 기업명은 한국에서 통용되는 이름을 사용하세요 (Apple → 애플, Tesla → 테슬라, NVIDIA → 엔비디아)
2. 티커 심볼은 그대로 유지하세요 (예: AAPL, TSLA)
3. 숫자, 날짜, 퍼센트는 그대로 유지하세요
4. 금융 전문 용어를 문맥에 맞게 번역하세요
5. JSON 배열 형식으로만 응답하세요

응답 형식 (JSON 배열만, 다른 텍스트 없이):
[{"headline_ko": "한글 제목", "summary_ko": "한글 요약"}, ...]`
          },
          {
            role: 'user',
            content: textsToTranslate,
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        console.warn(`AI gateway ${response.status}, returning untranslated`);
        return new Response(JSON.stringify({ translated: articles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let translations: any[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        translations = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse translation response:', content);
    }

    // Merge translations with original articles
    const translated = batch.map((article: any, i: number) => ({
      ...article,
      headline_ko: translations[i]?.headline_ko || article.headline,
      summary_ko: translations[i]?.summary_ko || article.summary,
      translated: !!translations[i]?.headline_ko,
    }));

    // Append remaining untranslated articles
    const remaining = articles.slice(10).map((a: any) => ({
      ...a,
      headline_ko: a.headline,
      summary_ko: a.summary,
      translated: false,
    }));

    return new Response(JSON.stringify({ translated: [...translated, ...remaining] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
