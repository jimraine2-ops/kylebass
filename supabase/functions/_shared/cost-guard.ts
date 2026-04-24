// ============================================================
// [No-Cost Policy] 후불 결제 0원 방어선
// ------------------------------------------------------------
// 모든 Edge Function에서 import 하여 사용. Lovable AI Gateway,
// 유료 LLM 엔드포인트, 알 수 없는 외부 결제 API 호출을 원천 차단.
//
// 정책:
//   - 외부 API는 반드시 Free Tier 키만 사용 (Finnhub, Twelve Data,
//     Polygon, exchangerate-api).
//   - Lovable AI Gateway 호출 금지. 필요 시 결정론적 룰로 대체.
//   - 각 함수는 부팅 시 assertNoBillableCalls()를 호출해
//     환경변수에 LOVABLE_API_KEY가 노출돼 있어도 실수로 사용되지
//     않도록 fetch 인터셉터를 설치한다.
// ============================================================

const BILLABLE_HOSTS = [
  'ai.gateway.lovable.dev',
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.cohere.ai',
  'api.replicate.com',
  'api.stability.ai',
];

let installed = false;

/** 한 번만 설치되는 전역 fetch 인터셉터. 유료 호스트 호출 시 즉시 throw. */
export function installCostGuard(): void {
  if (installed) return;
  installed = true;
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    try {
      url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url);
    } catch { /* ignore */ }
    if (url) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (BILLABLE_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
          console.error(`[CostGuard] BLOCKED billable call → ${host}`);
          return Promise.reject(new Error(`[CostGuard] Billable host blocked: ${host}`));
        }
      } catch { /* not a URL */ }
    }
    return orig(input, init);
  }) as typeof fetch;
  console.log('[CostGuard] ✓ 후불 호출 차단 가드 활성화 — 차단 호스트:', BILLABLE_HOSTS.length);
}
