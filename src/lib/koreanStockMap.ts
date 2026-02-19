/**
 * 한글 종목명 → 영어 티커 매핑 테이블
 * 주요 미국 상장 종목을 한국어로 검색할 수 있도록 지원
 */
export interface KoreanStockEntry {
  symbol: string;
  koreanName: string;
  englishName: string;
  category?: string;
}

export const KOREAN_STOCK_MAP: KoreanStockEntry[] = [
  // 빅테크
  { symbol: "AAPL", koreanName: "애플", englishName: "Apple", category: "빅테크" },
  { symbol: "MSFT", koreanName: "마이크로소프트", englishName: "Microsoft", category: "빅테크" },
  { symbol: "GOOGL", koreanName: "구글", englishName: "Alphabet", category: "빅테크" },
  { symbol: "GOOG", koreanName: "구글 C", englishName: "Alphabet C", category: "빅테크" },
  { symbol: "AMZN", koreanName: "아마존", englishName: "Amazon", category: "빅테크" },
  { symbol: "META", koreanName: "메타", englishName: "Meta", category: "빅테크" },
  { symbol: "NVDA", koreanName: "엔비디아", englishName: "NVIDIA", category: "반도체" },
  { symbol: "TSLA", koreanName: "테슬라", englishName: "Tesla", category: "전기차" },

  // 반도체
  { symbol: "AMD", koreanName: "에이엠디", englishName: "AMD", category: "반도체" },
  { symbol: "INTC", koreanName: "인텔", englishName: "Intel", category: "반도체" },
  { symbol: "QCOM", koreanName: "퀄컴", englishName: "Qualcomm", category: "반도체" },
  { symbol: "AVGO", koreanName: "브로드컴", englishName: "Broadcom", category: "반도체" },
  { symbol: "MU", koreanName: "마이크론", englishName: "Micron", category: "반도체" },
  { symbol: "AMAT", koreanName: "어플라이드 머티리얼즈", englishName: "Applied Materials", category: "반도체" },
  { symbol: "LRCX", koreanName: "램리서치", englishName: "Lam Research", category: "반도체" },
  { symbol: "KLAC", koreanName: "케이엘에이", englishName: "KLA Corp", category: "반도체" },
  { symbol: "MRVL", koreanName: "마벨테크", englishName: "Marvell Technology", category: "반도체" },
  { symbol: "ASML", koreanName: "에이에스엠엘", englishName: "ASML", category: "반도체" },
  { symbol: "TSM", koreanName: "대만반도체", englishName: "TSMC", category: "반도체" },

  // 금융
  { symbol: "JPM", koreanName: "제이피모건", englishName: "JPMorgan Chase", category: "금융" },
  { symbol: "BAC", koreanName: "뱅크오브아메리카", englishName: "Bank of America", category: "금융" },
  { symbol: "WFC", koreanName: "웰스파고", englishName: "Wells Fargo", category: "금융" },
  { symbol: "GS", koreanName: "골드만삭스", englishName: "Goldman Sachs", category: "금융" },
  { symbol: "MS", koreanName: "모건스탠리", englishName: "Morgan Stanley", category: "금융" },
  { symbol: "C", koreanName: "씨티그룹", englishName: "Citigroup", category: "금융" },
  { symbol: "V", koreanName: "비자", englishName: "Visa", category: "금융" },
  { symbol: "MA", koreanName: "마스터카드", englishName: "Mastercard", category: "금융" },
  { symbol: "PYPL", koreanName: "페이팔", englishName: "PayPal", category: "금융" },
  { symbol: "AXP", koreanName: "아메리칸익스프레스", englishName: "American Express", category: "금융" },
  { symbol: "BRK.B", koreanName: "버크셔해서웨이", englishName: "Berkshire Hathaway", category: "금융" },

  // 헬스케어
  { symbol: "JNJ", koreanName: "존슨앤존슨", englishName: "Johnson & Johnson", category: "헬스케어" },
  { symbol: "PFE", koreanName: "화이자", englishName: "Pfizer", category: "헬스케어" },
  { symbol: "MRNA", koreanName: "모더나", englishName: "Moderna", category: "헬스케어" },
  { symbol: "ABBV", koreanName: "애브비", englishName: "AbbVie", category: "헬스케어" },
  { symbol: "LLY", koreanName: "일라이릴리", englishName: "Eli Lilly", category: "헬스케어" },
  { symbol: "UNH", koreanName: "유나이티드헬스", englishName: "UnitedHealth", category: "헬스케어" },
  { symbol: "CVS", koreanName: "씨브이에스", englishName: "CVS Health", category: "헬스케어" },
  { symbol: "MDT", koreanName: "메드트로닉", englishName: "Medtronic", category: "헬스케어" },

  // 소비재 / 유통
  { symbol: "AMZN", koreanName: "아마존", englishName: "Amazon", category: "유통" },
  { symbol: "WMT", koreanName: "월마트", englishName: "Walmart", category: "유통" },
  { symbol: "COST", koreanName: "코스트코", englishName: "Costco", category: "유통" },
  { symbol: "TGT", koreanName: "타겟", englishName: "Target", category: "유통" },
  { symbol: "HD", koreanName: "홈디포", englishName: "Home Depot", category: "유통" },
  { symbol: "NKE", koreanName: "나이키", englishName: "Nike", category: "소비재" },
  { symbol: "SBUX", koreanName: "스타벅스", englishName: "Starbucks", category: "소비재" },
  { symbol: "MCD", koreanName: "맥도날드", englishName: "McDonald's", category: "소비재" },
  { symbol: "KO", koreanName: "코카콜라", englishName: "Coca-Cola", category: "소비재" },
  { symbol: "PEP", koreanName: "펩시콜라", englishName: "PepsiCo", category: "소비재" },
  { symbol: "PG", koreanName: "프록터앤갬블", englishName: "Procter & Gamble", category: "소비재" },

  // 에너지
  { symbol: "XOM", koreanName: "엑슨모빌", englishName: "ExxonMobil", category: "에너지" },
  { symbol: "CVX", koreanName: "쉐브론", englishName: "Chevron", category: "에너지" },
  { symbol: "COP", koreanName: "코노코필립스", englishName: "ConocoPhillips", category: "에너지" },
  { symbol: "SLB", koreanName: "슐럼버거", englishName: "Schlumberger", category: "에너지" },

  // 항공우주 / 방산
  { symbol: "BA", koreanName: "보잉", englishName: "Boeing", category: "항공우주" },
  { symbol: "LMT", koreanName: "록히드마틴", englishName: "Lockheed Martin", category: "방산" },
  { symbol: "RTX", koreanName: "레이시온", englishName: "Raytheon", category: "방산" },
  { symbol: "NOC", koreanName: "노스롭그루만", englishName: "Northrop Grumman", category: "방산" },

  // 클라우드 / SaaS
  { symbol: "CRM", koreanName: "세일즈포스", englishName: "Salesforce", category: "SaaS" },
  { symbol: "NOW", koreanName: "서비스나우", englishName: "ServiceNow", category: "SaaS" },
  { symbol: "SNOW", koreanName: "스노우플레이크", englishName: "Snowflake", category: "클라우드" },
  { symbol: "DDOG", koreanName: "데이터독", englishName: "Datadog", category: "클라우드" },
  { symbol: "PLTR", koreanName: "팔란티어", englishName: "Palantir", category: "AI" },
  { symbol: "ORCL", koreanName: "오라클", englishName: "Oracle", category: "클라우드" },
  { symbol: "SAP", koreanName: "에스에이피", englishName: "SAP", category: "SaaS" },
  { symbol: "ADBE", koreanName: "어도비", englishName: "Adobe", category: "SaaS" },
  { symbol: "INTU", koreanName: "인튜이트", englishName: "Intuit", category: "SaaS" },

  // 통신
  { symbol: "T", koreanName: "에이티앤티", englishName: "AT&T", category: "통신" },
  { symbol: "VZ", koreanName: "버라이즌", englishName: "Verizon", category: "통신" },
  { symbol: "TMUS", koreanName: "티모바일", englishName: "T-Mobile", category: "통신" },

  // 전기차 / 모빌리티
  { symbol: "RIVN", koreanName: "리비안", englishName: "Rivian", category: "전기차" },
  { symbol: "LCID", koreanName: "루시드", englishName: "Lucid Motors", category: "전기차" },
  { symbol: "F", koreanName: "포드", englishName: "Ford", category: "자동차" },
  { symbol: "GM", koreanName: "지엠", englishName: "General Motors", category: "자동차" },

  // AI / 로보틱스
  { symbol: "AI", koreanName: "씨쓰리에이아이", englishName: "C3.ai", category: "AI" },
  { symbol: "UPST", koreanName: "업스타트", englishName: "Upstart", category: "AI" },
  { symbol: "SOUN", koreanName: "사운드하운드", englishName: "SoundHound", category: "AI" },

  // 스트리밍 / 엔터
  { symbol: "NFLX", koreanName: "넷플릭스", englishName: "Netflix", category: "엔터" },
  { symbol: "DIS", koreanName: "디즈니", englishName: "Disney", category: "엔터" },
  { symbol: "SPOT", koreanName: "스포티파이", englishName: "Spotify", category: "엔터" },
  { symbol: "RBLX", koreanName: "로블록스", englishName: "Roblox", category: "게임" },

  // 암호화폐 관련
  { symbol: "COIN", koreanName: "코인베이스", englishName: "Coinbase", category: "크립토" },
  { symbol: "MSTR", koreanName: "마이크로스트래티지", englishName: "MicroStrategy", category: "크립토" },

  // 기타 인기 종목
  { symbol: "UBER", koreanName: "우버", englishName: "Uber", category: "모빌리티" },
  { symbol: "LYFT", koreanName: "리프트", englishName: "Lyft", category: "모빌리티" },
  { symbol: "ABNB", koreanName: "에어비앤비", englishName: "Airbnb", category: "여행" },
  { symbol: "BKNG", koreanName: "부킹닷컴", englishName: "Booking Holdings", category: "여행" },
  { symbol: "ZM", koreanName: "줌", englishName: "Zoom", category: "SaaS" },
  { symbol: "SHOP", koreanName: "쇼피파이", englishName: "Shopify", category: "커머스" },
  { symbol: "SQ", koreanName: "스퀘어", englishName: "Block (Square)", category: "핀테크" },
  { symbol: "HOOD", koreanName: "로빈후드", englishName: "Robinhood", category: "핀테크" },
];

/**
 * 한글 또는 영어 입력으로 종목 검색
 * - 한글 종목명 (부분 일치)
 * - 티커 (대소문자 무관)
 * - 영어 회사명 (부분 일치)
 */
export function searchKoreanStocks(query: string): KoreanStockEntry[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();

  return KOREAN_STOCK_MAP.filter((entry) => {
    const korMatch = entry.koreanName.toLowerCase().includes(q);
    const symMatch = entry.symbol.toLowerCase().includes(q);
    const engMatch = entry.englishName.toLowerCase().includes(q);
    return korMatch || symMatch || engMatch;
  }).slice(0, 10);
}
