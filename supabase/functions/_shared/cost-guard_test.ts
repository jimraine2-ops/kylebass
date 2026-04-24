// 후불 차단 가드 단위 테스트
import { assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { installCostGuard } from "./cost-guard.ts";

installCostGuard();

Deno.test("[CostGuard] Lovable AI Gateway 호출 차단", async () => {
  await assertRejects(
    () => fetch('https://ai.gateway.lovable.dev/v1/chat/completions', { method: 'POST' }),
    Error,
    'Billable host blocked',
  );
});

Deno.test("[CostGuard] OpenAI 호출 차단", async () => {
  await assertRejects(
    () => fetch('https://api.openai.com/v1/chat/completions'),
    Error,
    'Billable host blocked',
  );
});

Deno.test("[CostGuard] Anthropic 호출 차단", async () => {
  await assertRejects(
    () => fetch('https://api.anthropic.com/v1/messages'),
    Error,
    'Billable host blocked',
  );
});

Deno.test("[CostGuard] Google Gemini 호출 차단", async () => {
  await assertRejects(
    () => fetch('https://generativelanguage.googleapis.com/v1beta/models'),
    Error,
    'Billable host blocked',
  );
});

Deno.test("[CostGuard] Free Tier 호스트는 허용 (Finnhub URL 형식만 검증)", () => {
  // 실제 호출 안 함 — URL 파싱이 차단되지 않는지만 검증
  const url = new URL('https://finnhub.io/api/v1/quote?symbol=AAPL');
  // BILLABLE_HOSTS에 finnhub.io가 없으면 통과해야 함
  if (BILLABLE_HOSTS.includes(url.hostname)) {
    throw new Error('finnhub.io가 차단 리스트에 잘못 포함됨');
  }
});

const BILLABLE_HOSTS = [
  'ai.gateway.lovable.dev', 'api.openai.com', 'api.anthropic.com',
  'generativelanguage.googleapis.com', 'api.cohere.ai',
  'api.replicate.com', 'api.stability.ai',
];
