---
name: Pre-Calculation & Day Session Sniping
description: EMA25 기반 선제적 타겟가 산출(P_Target = EMA25×(1-Margin)), 30억+ 수급주 Liquidity-Trap 알박기(-1.5%), US 정규장 마감 → KST 09:00 Bridge-Logic 자동 매수 예약
type: feature
---
## [선제적 체결] 데이장 스나이핑 & 매수 예약 시스템

### Pre-Calculation (진입가 선제 산출)
- P_Target = EMA₂₅ × (1 - Margin)
- Margin: 5~7% (이격도에 따라 동적 조정: 7%↑이격→+2%, 6%↑→+1%)
- 반등이 나올 수밖에 없는 '절대 가격'을 미리 계산

### Liquidity-Trap (데이장 그물망)
- 시장가 매수 절대 금지
- 30억↑ 수급주: 지연 데이터 저점 대비 -1.5% 알박기(Bid)
- 호가 두꺼운 종목의 하방 경직성 역이용

### Bridge-Logic (US 마감 → 데이장 연결)
- KST 09:00 데이장 개시 직전, US 정규장 마감 데이터 동기화
- 25봉 하락 + EMA25 이격 5%+ 완성 종목 자동 탐지
- KST 09:00:01 즉시 P_Target 가격으로 매수 예약 투입
