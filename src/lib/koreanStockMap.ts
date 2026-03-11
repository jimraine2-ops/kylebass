/**
 * 한글 종목명 → 영어 티커 매핑 테이블
 * 주요 미국 상장 종목 500+ 한국어 검색 지원
 */
export interface KoreanStockEntry {
  symbol: string;
  koreanName: string;
  englishName: string;
  category?: string;
  aliases?: string[]; // 동의어/별칭
}

export const KOREAN_STOCK_MAP: KoreanStockEntry[] = [
  // ===== 빅테크 (Mega Cap Tech) =====
  { symbol: "AAPL", koreanName: "애플", englishName: "Apple", category: "빅테크", aliases: ["아이폰", "맥북"] },
  { symbol: "MSFT", koreanName: "마이크로소프트", englishName: "Microsoft", category: "빅테크", aliases: ["MS", "윈도우", "엠에스"] },
  { symbol: "GOOGL", koreanName: "구글", englishName: "Alphabet", category: "빅테크", aliases: ["알파벳", "유튜브"] },
  { symbol: "GOOG", koreanName: "구글 C", englishName: "Alphabet C", category: "빅테크", aliases: ["알파벳C"] },
  { symbol: "AMZN", koreanName: "아마존", englishName: "Amazon", category: "빅테크", aliases: ["AWS"] },
  { symbol: "META", koreanName: "메타", englishName: "Meta Platforms", category: "빅테크", aliases: ["페이스북", "인스타그램", "메타플랫폼"] },
  { symbol: "NVDA", koreanName: "엔비디아", englishName: "NVIDIA", category: "반도체", aliases: ["엔디비아", "지포스"] },
  { symbol: "TSLA", koreanName: "테슬라", englishName: "Tesla", category: "전기차", aliases: ["일론머스크"] },

  // ===== 반도체 (Semiconductors) =====
  { symbol: "AMD", koreanName: "에이엠디", englishName: "AMD", category: "반도체", aliases: ["어드밴스드마이크로"] },
  { symbol: "INTC", koreanName: "인텔", englishName: "Intel", category: "반도체" },
  { symbol: "QCOM", koreanName: "퀄컴", englishName: "Qualcomm", category: "반도체" },
  { symbol: "AVGO", koreanName: "브로드컴", englishName: "Broadcom", category: "반도체" },
  { symbol: "MU", koreanName: "마이크론", englishName: "Micron", category: "반도체" },
  { symbol: "AMAT", koreanName: "어플라이드머티리얼즈", englishName: "Applied Materials", category: "반도체" },
  { symbol: "LRCX", koreanName: "램리서치", englishName: "Lam Research", category: "반도체" },
  { symbol: "KLAC", koreanName: "케이엘에이", englishName: "KLA Corp", category: "반도체" },
  { symbol: "MRVL", koreanName: "마벨테크놀로지", englishName: "Marvell Technology", category: "반도체" },
  { symbol: "ASML", koreanName: "에이에스엠엘", englishName: "ASML", category: "반도체" },
  { symbol: "TSM", koreanName: "TSMC", englishName: "Taiwan Semiconductor", category: "반도체", aliases: ["대만반도체", "티에스엠씨"] },
  { symbol: "ADI", koreanName: "아날로그디바이시스", englishName: "Analog Devices", category: "반도체" },
  { symbol: "NXPI", koreanName: "엔엑스피", englishName: "NXP Semiconductors", category: "반도체" },
  { symbol: "TXN", koreanName: "텍사스인스트루먼트", englishName: "Texas Instruments", category: "반도체", aliases: ["TI"] },
  { symbol: "ON", koreanName: "온세미컨덕터", englishName: "ON Semiconductor", category: "반도체" },
  { symbol: "SWKS", koreanName: "스카이웍스", englishName: "Skyworks Solutions", category: "반도체" },
  { symbol: "MCHP", koreanName: "마이크로칩", englishName: "Microchip Technology", category: "반도체" },
  { symbol: "ARM", koreanName: "암홀딩스", englishName: "ARM Holdings", category: "반도체", aliases: ["에이알엠"] },

  // ===== 금융 (Finance) =====
  { symbol: "JPM", koreanName: "제이피모건", englishName: "JPMorgan Chase", category: "금융" },
  { symbol: "BAC", koreanName: "뱅크오브아메리카", englishName: "Bank of America", category: "금융", aliases: ["BOA"] },
  { symbol: "WFC", koreanName: "웰스파고", englishName: "Wells Fargo", category: "금융" },
  { symbol: "GS", koreanName: "골드만삭스", englishName: "Goldman Sachs", category: "금융" },
  { symbol: "MS", koreanName: "모건스탠리", englishName: "Morgan Stanley", category: "금융" },
  { symbol: "C", koreanName: "씨티그룹", englishName: "Citigroup", category: "금융" },
  { symbol: "V", koreanName: "비자", englishName: "Visa", category: "금융" },
  { symbol: "MA", koreanName: "마스터카드", englishName: "Mastercard", category: "금융" },
  { symbol: "PYPL", koreanName: "페이팔", englishName: "PayPal", category: "핀테크" },
  { symbol: "AXP", koreanName: "아메리칸익스프레스", englishName: "American Express", category: "금융" },
  { symbol: "BRK.B", koreanName: "버크셔해서웨이", englishName: "Berkshire Hathaway", category: "금융", aliases: ["워런버핏"] },
  { symbol: "SCHW", koreanName: "찰스슈왑", englishName: "Charles Schwab", category: "금융" },
  { symbol: "BLK", koreanName: "블랙록", englishName: "BlackRock", category: "금융" },
  { symbol: "SPGI", koreanName: "S&P글로벌", englishName: "S&P Global", category: "금융" },
  { symbol: "CME", koreanName: "시카고거래소", englishName: "CME Group", category: "금융" },
  { symbol: "ICE", koreanName: "인터컨티넨탈익스체인지", englishName: "Intercontinental Exchange", category: "금융" },
  { symbol: "MCO", koreanName: "무디스", englishName: "Moody's", category: "금융" },
  { symbol: "COF", koreanName: "캐피탈원", englishName: "Capital One", category: "금융" },
  { symbol: "USB", koreanName: "US뱅코프", englishName: "US Bancorp", category: "금융" },
  { symbol: "PNC", koreanName: "피앤씨파이낸셜", englishName: "PNC Financial", category: "금융" },
  { symbol: "TFC", koreanName: "트루이스트파이낸셜", englishName: "Truist Financial", category: "금융" },
  { symbol: "AIG", koreanName: "에이아이지", englishName: "AIG", category: "보험" },
  { symbol: "MET", koreanName: "메트라이프", englishName: "MetLife", category: "보험" },
  { symbol: "PRU", koreanName: "프루덴셜", englishName: "Prudential", category: "보험" },

  // ===== 헬스케어 (Healthcare) =====
  { symbol: "JNJ", koreanName: "존슨앤존슨", englishName: "Johnson & Johnson", category: "헬스케어" },
  { symbol: "PFE", koreanName: "화이자", englishName: "Pfizer", category: "헬스케어" },
  { symbol: "MRNA", koreanName: "모더나", englishName: "Moderna", category: "바이오" },
  { symbol: "ABBV", koreanName: "애브비", englishName: "AbbVie", category: "헬스케어" },
  { symbol: "LLY", koreanName: "일라이릴리", englishName: "Eli Lilly", category: "헬스케어" },
  { symbol: "UNH", koreanName: "유나이티드헬스", englishName: "UnitedHealth", category: "헬스케어" },
  { symbol: "CVS", koreanName: "씨브이에스헬스", englishName: "CVS Health", category: "헬스케어" },
  { symbol: "MDT", koreanName: "메드트로닉", englishName: "Medtronic", category: "의료기기" },
  { symbol: "TMO", koreanName: "써모피셔", englishName: "Thermo Fisher", category: "헬스케어" },
  { symbol: "ABT", koreanName: "애보트", englishName: "Abbott Labs", category: "의료기기" },
  { symbol: "DHR", koreanName: "다나허", englishName: "Danaher", category: "헬스케어" },
  { symbol: "BMY", koreanName: "브리스톨마이어스", englishName: "Bristol-Myers Squibb", category: "헬스케어" },
  { symbol: "AMGN", koreanName: "암젠", englishName: "Amgen", category: "바이오" },
  { symbol: "GILD", koreanName: "길리어드", englishName: "Gilead Sciences", category: "바이오" },
  { symbol: "ISRG", koreanName: "인튜이티브서지컬", englishName: "Intuitive Surgical", category: "의료기기", aliases: ["다빈치로봇"] },
  { symbol: "VRTX", koreanName: "버텍스", englishName: "Vertex Pharmaceuticals", category: "바이오" },
  { symbol: "REGN", koreanName: "리제네론", englishName: "Regeneron", category: "바이오" },
  { symbol: "ZTS", koreanName: "조에티스", englishName: "Zoetis", category: "헬스케어" },
  { symbol: "SYK", koreanName: "스트라이커", englishName: "Stryker", category: "의료기기" },
  { symbol: "BSX", koreanName: "보스턴사이언티픽", englishName: "Boston Scientific", category: "의료기기" },
  { symbol: "EW", koreanName: "에드워즈라이프사이언스", englishName: "Edwards Lifesciences", category: "의료기기" },
  { symbol: "BIIB", koreanName: "바이오젠", englishName: "Biogen", category: "바이오" },
  { symbol: "CI", koreanName: "시그나", englishName: "Cigna", category: "헬스케어" },
  { symbol: "HUM", koreanName: "휴매나", englishName: "Humana", category: "헬스케어" },
  { symbol: "ELV", koreanName: "엘레번스헬스", englishName: "Elevance Health", category: "헬스케어" },
  { symbol: "MCK", koreanName: "맥케슨", englishName: "McKesson", category: "헬스케어" },
  { symbol: "NVO", koreanName: "노보노디스크", englishName: "Novo Nordisk", category: "헬스케어", aliases: ["위고비", "오젬픽"] },

  // ===== 소비재 / 유통 (Consumer) =====
  { symbol: "WMT", koreanName: "월마트", englishName: "Walmart", category: "유통" },
  { symbol: "COST", koreanName: "코스트코", englishName: "Costco", category: "유통" },
  { symbol: "TGT", koreanName: "타겟", englishName: "Target", category: "유통" },
  { symbol: "HD", koreanName: "홈디포", englishName: "Home Depot", category: "유통" },
  { symbol: "LOW", koreanName: "로우스", englishName: "Lowe's", category: "유통" },
  { symbol: "NKE", koreanName: "나이키", englishName: "Nike", category: "소비재" },
  { symbol: "SBUX", koreanName: "스타벅스", englishName: "Starbucks", category: "소비재" },
  { symbol: "MCD", koreanName: "맥도날드", englishName: "McDonald's", category: "소비재" },
  { symbol: "KO", koreanName: "코카콜라", englishName: "Coca-Cola", category: "소비재" },
  { symbol: "PEP", koreanName: "펩시", englishName: "PepsiCo", category: "소비재", aliases: ["펩시콜라"] },
  { symbol: "PG", koreanName: "프록터앤갬블", englishName: "Procter & Gamble", category: "소비재", aliases: ["P&G"] },
  { symbol: "CL", koreanName: "콜게이트팜올리브", englishName: "Colgate-Palmolive", category: "소비재" },
  { symbol: "EL", koreanName: "에스티로더", englishName: "Estée Lauder", category: "소비재" },
  { symbol: "MNST", koreanName: "몬스터음료", englishName: "Monster Beverage", category: "소비재" },
  { symbol: "KDP", koreanName: "케우리그닥터페퍼", englishName: "Keurig Dr Pepper", category: "소비재" },
  { symbol: "KHC", koreanName: "크래프트하인즈", englishName: "Kraft Heinz", category: "소비재" },
  { symbol: "GIS", koreanName: "제너럴밀스", englishName: "General Mills", category: "소비재" },
  { symbol: "HSY", koreanName: "허쉬", englishName: "Hershey", category: "소비재" },
  { symbol: "STZ", koreanName: "컨스텔레이션", englishName: "Constellation Brands", category: "소비재" },
  { symbol: "MDLZ", koreanName: "몬덜리즈", englishName: "Mondelez", category: "소비재" },
  { symbol: "CMG", koreanName: "치폴레", englishName: "Chipotle Mexican Grill", category: "소비재" },
  { symbol: "YUM", koreanName: "얌브랜즈", englishName: "Yum! Brands", category: "소비재", aliases: ["KFC", "피자헛"] },
  { symbol: "LULU", koreanName: "룰루레몬", englishName: "Lululemon", category: "소비재" },
  { symbol: "TJX", koreanName: "티제이맥스", englishName: "TJX Companies", category: "유통" },
  { symbol: "ROST", koreanName: "로스스토어즈", englishName: "Ross Stores", category: "유통" },
  { symbol: "DG", koreanName: "달러제너럴", englishName: "Dollar General", category: "유통" },
  { symbol: "DLTR", koreanName: "달러트리", englishName: "Dollar Tree", category: "유통" },

  // ===== 에너지 (Energy) =====
  { symbol: "XOM", koreanName: "엑슨모빌", englishName: "ExxonMobil", category: "에너지" },
  { symbol: "CVX", koreanName: "쉐브론", englishName: "Chevron", category: "에너지" },
  { symbol: "COP", koreanName: "코노코필립스", englishName: "ConocoPhillips", category: "에너지" },
  { symbol: "SLB", koreanName: "슐럼버거", englishName: "SLB (Schlumberger)", category: "에너지" },
  { symbol: "EOG", koreanName: "이오지리소시스", englishName: "EOG Resources", category: "에너지" },
  { symbol: "MPC", koreanName: "마라톤페트롤리엄", englishName: "Marathon Petroleum", category: "에너지" },
  { symbol: "PSX", koreanName: "필립스66", englishName: "Phillips 66", category: "에너지" },
  { symbol: "VLO", koreanName: "발레로에너지", englishName: "Valero Energy", category: "에너지" },
  { symbol: "OXY", koreanName: "옥시덴탈", englishName: "Occidental Petroleum", category: "에너지" },
  { symbol: "PXD", koreanName: "파이오니어", englishName: "Pioneer Natural Resources", category: "에너지" },
  { symbol: "HAL", koreanName: "할리버튼", englishName: "Halliburton", category: "에너지" },
  { symbol: "DVN", koreanName: "데본에너지", englishName: "Devon Energy", category: "에너지" },
  { symbol: "FANG", koreanName: "다이아몬드백", englishName: "Diamondback Energy", category: "에너지" },
  { symbol: "BKR", koreanName: "베이커휴즈", englishName: "Baker Hughes", category: "에너지" },
  { symbol: "ENPH", koreanName: "엔페이즈에너지", englishName: "Enphase Energy", category: "신재생" },
  { symbol: "SEDG", koreanName: "솔라엣지", englishName: "SolarEdge", category: "신재생" },
  { symbol: "FSLR", koreanName: "퍼스트솔라", englishName: "First Solar", category: "신재생" },
  { symbol: "NEE", koreanName: "넥스트에라에너지", englishName: "NextEra Energy", category: "유틸리티" },
  { symbol: "DUK", koreanName: "듀크에너지", englishName: "Duke Energy", category: "유틸리티" },
  { symbol: "SO", koreanName: "서던컴퍼니", englishName: "Southern Company", category: "유틸리티" },

  // ===== 항공우주 / 방산 (Aerospace & Defense) =====
  { symbol: "BA", koreanName: "보잉", englishName: "Boeing", category: "항공우주" },
  { symbol: "LMT", koreanName: "록히드마틴", englishName: "Lockheed Martin", category: "방산" },
  { symbol: "RTX", koreanName: "레이시온", englishName: "RTX (Raytheon)", category: "방산" },
  { symbol: "NOC", koreanName: "노스롭그루먼", englishName: "Northrop Grumman", category: "방산" },
  { symbol: "GD", koreanName: "제너럴다이나믹스", englishName: "General Dynamics", category: "방산" },
  { symbol: "HII", koreanName: "헌팅턴인걸스", englishName: "Huntington Ingalls", category: "방산" },
  { symbol: "LHX", koreanName: "L3해리스", englishName: "L3Harris Technologies", category: "방산" },
  { symbol: "TDG", koreanName: "트랜스다임", englishName: "TransDigm", category: "항공우주" },

  // ===== 클라우드 / SaaS =====
  { symbol: "CRM", koreanName: "세일즈포스", englishName: "Salesforce", category: "SaaS" },
  { symbol: "NOW", koreanName: "서비스나우", englishName: "ServiceNow", category: "SaaS" },
  { symbol: "SNOW", koreanName: "스노우플레이크", englishName: "Snowflake", category: "클라우드" },
  { symbol: "DDOG", koreanName: "데이터독", englishName: "Datadog", category: "클라우드" },
  { symbol: "PLTR", koreanName: "팔란티어", englishName: "Palantir", category: "AI" },
  { symbol: "ORCL", koreanName: "오라클", englishName: "Oracle", category: "클라우드" },
  { symbol: "SAP", koreanName: "에스에이피", englishName: "SAP", category: "SaaS" },
  { symbol: "ADBE", koreanName: "어도비", englishName: "Adobe", category: "SaaS" },
  { symbol: "INTU", koreanName: "인튜이트", englishName: "Intuit", category: "SaaS" },
  { symbol: "WDAY", koreanName: "워크데이", englishName: "Workday", category: "SaaS" },
  { symbol: "PANW", koreanName: "팔로알토네트웍스", englishName: "Palo Alto Networks", category: "보안" },
  { symbol: "CRWD", koreanName: "크라우드스트라이크", englishName: "CrowdStrike", category: "보안" },
  { symbol: "FTNT", koreanName: "포티넷", englishName: "Fortinet", category: "보안" },
  { symbol: "ZS", koreanName: "지스케일러", englishName: "Zscaler", category: "보안" },
  { symbol: "NET", koreanName: "클라우드플레어", englishName: "Cloudflare", category: "클라우드" },
  { symbol: "MDB", koreanName: "몽고디비", englishName: "MongoDB", category: "클라우드" },
  { symbol: "TEAM", koreanName: "아틀라시안", englishName: "Atlassian", category: "SaaS" },
  { symbol: "HUBS", koreanName: "허브스팟", englishName: "HubSpot", category: "SaaS" },
  { symbol: "VEEV", koreanName: "비바시스템즈", englishName: "Veeva Systems", category: "SaaS" },
  { symbol: "DOCU", koreanName: "도큐사인", englishName: "DocuSign", category: "SaaS" },
  { symbol: "OKTA", koreanName: "옥타", englishName: "Okta", category: "보안" },
  { symbol: "SPLK", koreanName: "스플렁크", englishName: "Splunk", category: "클라우드" },
  { symbol: "TWLO", koreanName: "트윌리오", englishName: "Twilio", category: "클라우드" },
  { symbol: "TTD", koreanName: "트레이드데스크", englishName: "The Trade Desk", category: "광고" },
  { symbol: "U", koreanName: "유니티", englishName: "Unity Software", category: "게임" },

  // ===== 통신 (Telecom) =====
  { symbol: "T", koreanName: "에이티앤티", englishName: "AT&T", category: "통신" },
  { symbol: "VZ", koreanName: "버라이즌", englishName: "Verizon", category: "통신" },
  { symbol: "TMUS", koreanName: "티모바일", englishName: "T-Mobile", category: "통신" },
  { symbol: "CMCSA", koreanName: "컴캐스트", englishName: "Comcast", category: "통신" },
  { symbol: "CHTR", koreanName: "차터커뮤니케이션즈", englishName: "Charter Communications", category: "통신" },

  // ===== 전기차 / 자동차 (EV & Auto) =====
  { symbol: "RIVN", koreanName: "리비안", englishName: "Rivian", category: "전기차" },
  { symbol: "LCID", koreanName: "루시드", englishName: "Lucid Motors", category: "전기차" },
  { symbol: "F", koreanName: "포드", englishName: "Ford", category: "자동차" },
  { symbol: "GM", koreanName: "지엠", englishName: "General Motors", category: "자동차" },
  { symbol: "TM", koreanName: "도요타", englishName: "Toyota", category: "자동차" },
  { symbol: "HMC", koreanName: "혼다", englishName: "Honda", category: "자동차" },
  { symbol: "STLA", koreanName: "스텔란티스", englishName: "Stellantis", category: "자동차" },
  { symbol: "NIO", koreanName: "니오", englishName: "NIO", category: "전기차" },
  { symbol: "XPEV", koreanName: "샤오펑", englishName: "XPeng", category: "전기차" },
  { symbol: "LI", koreanName: "리오토", englishName: "Li Auto", category: "전기차" },
  { symbol: "BYD", koreanName: "비야디", englishName: "BYD", category: "전기차" },

  // ===== AI / 로보틱스 =====
  { symbol: "AI", koreanName: "씨쓰리에이아이", englishName: "C3.ai", category: "AI" },
  { symbol: "UPST", koreanName: "업스타트", englishName: "Upstart", category: "AI" },
  { symbol: "SOUN", koreanName: "사운드하운드", englishName: "SoundHound AI", category: "AI" },
  { symbol: "PATH", koreanName: "유아이패스", englishName: "UiPath", category: "AI", aliases: ["RPA"] },
  { symbol: "BBAI", koreanName: "빅베어AI", englishName: "BigBear.ai", category: "AI" },
  { symbol: "IONQ", koreanName: "아이온큐", englishName: "IonQ", category: "양자컴퓨터" },
  { symbol: "RGTI", koreanName: "리게티컴퓨팅", englishName: "Rigetti Computing", category: "양자컴퓨터" },

  // ===== 스트리밍 / 엔터 (Entertainment) =====
  { symbol: "NFLX", koreanName: "넷플릭스", englishName: "Netflix", category: "엔터" },
  { symbol: "DIS", koreanName: "디즈니", englishName: "Walt Disney", category: "엔터", aliases: ["디즈니플러스", "월트디즈니"] },
  { symbol: "SPOT", koreanName: "스포티파이", englishName: "Spotify", category: "엔터" },
  { symbol: "RBLX", koreanName: "로블록스", englishName: "Roblox", category: "게임" },
  { symbol: "WBD", koreanName: "워너브라더스", englishName: "Warner Bros Discovery", category: "엔터" },
  { symbol: "PARA", koreanName: "파라마운트", englishName: "Paramount", category: "엔터" },
  { symbol: "EA", koreanName: "일렉트로닉아츠", englishName: "Electronic Arts", category: "게임" },
  { symbol: "TTWO", koreanName: "테이크투", englishName: "Take-Two Interactive", category: "게임", aliases: ["GTA", "락스타게임즈"] },
  { symbol: "ATVI", koreanName: "액티비전블리자드", englishName: "Activision Blizzard", category: "게임" },
  { symbol: "ROKU", koreanName: "로쿠", englishName: "Roku", category: "엔터" },
  { symbol: "LYV", koreanName: "라이브네이션", englishName: "Live Nation", category: "엔터" },

  // ===== 암호화폐 관련 (Crypto) =====
  { symbol: "COIN", koreanName: "코인베이스", englishName: "Coinbase", category: "크립토" },
  { symbol: "MSTR", koreanName: "마이크로스트래티지", englishName: "MicroStrategy", category: "크립토", aliases: ["비트코인"] },
  { symbol: "MARA", koreanName: "마라홀딩스", englishName: "Marathon Digital", category: "크립토" },
  { symbol: "RIOT", koreanName: "라이엇플랫폼", englishName: "Riot Platforms", category: "크립토" },
  { symbol: "CLSK", koreanName: "클린스파크", englishName: "CleanSpark", category: "크립토" },

  // ===== 모빌리티 / 여행 (Mobility & Travel) =====
  { symbol: "UBER", koreanName: "우버", englishName: "Uber", category: "모빌리티" },
  { symbol: "LYFT", koreanName: "리프트", englishName: "Lyft", category: "모빌리티" },
  { symbol: "ABNB", koreanName: "에어비앤비", englishName: "Airbnb", category: "여행" },
  { symbol: "BKNG", koreanName: "부킹닷컴", englishName: "Booking Holdings", category: "여행" },
  { symbol: "EXPE", koreanName: "익스피디아", englishName: "Expedia", category: "여행" },
  { symbol: "MAR", koreanName: "매리어트", englishName: "Marriott International", category: "여행" },
  { symbol: "HLT", koreanName: "힐튼", englishName: "Hilton Worldwide", category: "여행" },
  { symbol: "DAL", koreanName: "델타항공", englishName: "Delta Air Lines", category: "항공" },
  { symbol: "UAL", koreanName: "유나이티드항공", englishName: "United Airlines", category: "항공" },
  { symbol: "LUV", koreanName: "사우스웨스트항공", englishName: "Southwest Airlines", category: "항공" },
  { symbol: "AAL", koreanName: "아메리칸항공", englishName: "American Airlines", category: "항공" },
  { symbol: "DASH", koreanName: "도어대시", englishName: "DoorDash", category: "배달" },

  // ===== 핀테크 / 커머스 (Fintech & Commerce) =====
  { symbol: "ZM", koreanName: "줌", englishName: "Zoom Video", category: "SaaS" },
  { symbol: "SHOP", koreanName: "쇼피파이", englishName: "Shopify", category: "커머스" },
  { symbol: "SQ", koreanName: "블록", englishName: "Block (Square)", category: "핀테크", aliases: ["스퀘어"] },
  { symbol: "HOOD", koreanName: "로빈후드", englishName: "Robinhood", category: "핀테크" },
  { symbol: "AFRM", koreanName: "어펌", englishName: "Affirm", category: "핀테크" },
  { symbol: "SOFI", koreanName: "소파이", englishName: "SoFi Technologies", category: "핀테크" },
  { symbol: "NU", koreanName: "누홀딩스", englishName: "Nu Holdings", category: "핀테크" },
  { symbol: "BILL", koreanName: "빌닷컴", englishName: "Bill.com", category: "핀테크" },
  { symbol: "FIS", koreanName: "피델리티국제", englishName: "Fidelity National Information", category: "핀테크" },
  { symbol: "FISV", koreanName: "파이서브", englishName: "Fiserv", category: "핀테크" },
  { symbol: "GPN", koreanName: "글로벌페이먼츠", englishName: "Global Payments", category: "핀테크" },

  // ===== 산업재 (Industrials) =====
  { symbol: "CAT", koreanName: "캐터필러", englishName: "Caterpillar", category: "산업재" },
  { symbol: "DE", koreanName: "디어앤컴퍼니", englishName: "Deere & Company", category: "산업재", aliases: ["존디어"] },
  { symbol: "HON", koreanName: "허니웰", englishName: "Honeywell", category: "산업재" },
  { symbol: "MMM", koreanName: "쓰리엠", englishName: "3M", category: "산업재", aliases: ["3M"] },
  { symbol: "GE", koreanName: "제너럴일렉트릭", englishName: "GE Aerospace", category: "산업재", aliases: ["GE"] },
  { symbol: "UNP", koreanName: "유니온퍼시픽", englishName: "Union Pacific", category: "운송" },
  { symbol: "UPS", koreanName: "유피에스", englishName: "UPS", category: "운송" },
  { symbol: "FDX", koreanName: "페덱스", englishName: "FedEx", category: "운송" },
  { symbol: "WM", koreanName: "웨이스트매니지먼트", englishName: "Waste Management", category: "환경" },
  { symbol: "RSG", koreanName: "리퍼블릭서비스", englishName: "Republic Services", category: "환경" },
  { symbol: "EMR", koreanName: "에머슨일렉트릭", englishName: "Emerson Electric", category: "산업재" },
  { symbol: "ETN", koreanName: "이튼", englishName: "Eaton", category: "산업재" },
  { symbol: "ITW", koreanName: "일리노이툴웍스", englishName: "Illinois Tool Works", category: "산업재" },
  { symbol: "CSX", koreanName: "씨에스엑스", englishName: "CSX", category: "운송" },
  { symbol: "NSC", koreanName: "노포크서던", englishName: "Norfolk Southern", category: "운송" },

  // ===== 소재 (Materials) =====
  { symbol: "LIN", koreanName: "린데", englishName: "Linde", category: "소재" },
  { symbol: "APD", koreanName: "에어프로덕츠", englishName: "Air Products", category: "소재" },
  { symbol: "SHW", koreanName: "셔윈윌리엄즈", englishName: "Sherwin-Williams", category: "소재" },
  { symbol: "ECL", koreanName: "에코랩", englishName: "Ecolab", category: "소재" },
  { symbol: "DD", koreanName: "듀폰", englishName: "DuPont", category: "소재" },
  { symbol: "DOW", koreanName: "다우", englishName: "Dow Inc", category: "소재" },
  { symbol: "FCX", koreanName: "프리포트맥모란", englishName: "Freeport-McMoRan", category: "소재", aliases: ["구리"] },
  { symbol: "NEM", koreanName: "뉴몬트", englishName: "Newmont", category: "소재", aliases: ["금광"] },
  { symbol: "NUE", koreanName: "뉴코어", englishName: "Nucor", category: "소재", aliases: ["철강"] },
  { symbol: "STLD", koreanName: "스틸다이나믹스", englishName: "Steel Dynamics", category: "소재" },
  { symbol: "ALB", koreanName: "앨버말", englishName: "Albemarle", category: "소재", aliases: ["리튬"] },

  // ===== 부동산 (REITs) =====
  { symbol: "PLD", koreanName: "프로로지스", englishName: "Prologis", category: "리츠" },
  { symbol: "AMT", koreanName: "아메리칸타워", englishName: "American Tower", category: "리츠" },
  { symbol: "CCI", koreanName: "크라운캐슬", englishName: "Crown Castle", category: "리츠" },
  { symbol: "EQIX", koreanName: "에퀴닉스", englishName: "Equinix", category: "리츠" },
  { symbol: "SPG", koreanName: "사이먼프로퍼티", englishName: "Simon Property Group", category: "리츠" },
  { symbol: "O", koreanName: "리얼티인컴", englishName: "Realty Income", category: "리츠" },
  { symbol: "WELL", koreanName: "웰타워", englishName: "Welltower", category: "리츠" },
  { symbol: "DLR", koreanName: "디지털리얼티", englishName: "Digital Realty", category: "리츠" },
  { symbol: "PSA", koreanName: "퍼블릭스토리지", englishName: "Public Storage", category: "리츠" },

  // ===== 기타 인기 종목 =====
  { symbol: "SNAP", koreanName: "스냅", englishName: "Snap", category: "소셜", aliases: ["스냅챗"] },
  { symbol: "PINS", koreanName: "핀터레스트", englishName: "Pinterest", category: "소셜" },
  { symbol: "RDDT", koreanName: "레딧", englishName: "Reddit", category: "소셜" },
  { symbol: "W", koreanName: "웨이페어", englishName: "Wayfair", category: "커머스" },
  { symbol: "ETSY", koreanName: "엣시", englishName: "Etsy", category: "커머스" },
  { symbol: "CHWY", koreanName: "츄이", englishName: "Chewy", category: "커머스" },
  { symbol: "CPNG", koreanName: "쿠팡", englishName: "Coupang", category: "커머스" },
  { symbol: "SE", koreanName: "씨리미티드", englishName: "Sea Limited", category: "커머스", aliases: ["쇼피"] },
  { symbol: "BABA", koreanName: "알리바바", englishName: "Alibaba", category: "중국빅테크" },
  { symbol: "JD", koreanName: "징둥", englishName: "JD.com", category: "중국빅테크" },
  { symbol: "PDD", koreanName: "핀듀오듀오", englishName: "PDD Holdings", category: "중국빅테크", aliases: ["테무"] },
  { symbol: "BIDU", koreanName: "바이두", englishName: "Baidu", category: "중국빅테크" },
  { symbol: "TCEHY", koreanName: "텐센트", englishName: "Tencent", category: "중국빅테크" },

  // ===== ETF (인기 ETF) =====
  { symbol: "SPY", koreanName: "S&P500 ETF", englishName: "SPDR S&P 500", category: "ETF" },
  { symbol: "QQQ", koreanName: "나스닥100 ETF", englishName: "Invesco QQQ", category: "ETF" },
  { symbol: "IWM", koreanName: "러셀2000 ETF", englishName: "iShares Russell 2000", category: "ETF" },
  { symbol: "DIA", koreanName: "다우존스 ETF", englishName: "SPDR Dow Jones", category: "ETF" },
  { symbol: "VOO", koreanName: "뱅가드S&P500", englishName: "Vanguard S&P 500", category: "ETF" },
  { symbol: "VTI", koreanName: "뱅가드토탈마켓", englishName: "Vanguard Total Stock Market", category: "ETF" },
  { symbol: "ARKK", koreanName: "아크이노베이션", englishName: "ARK Innovation", category: "ETF", aliases: ["캐시우드"] },
  { symbol: "SOXL", koreanName: "반도체3배레버리지", englishName: "Direxion Semiconductor Bull 3x", category: "ETF" },
  { symbol: "TQQQ", koreanName: "나스닥3배레버리지", englishName: "ProShares UltraPro QQQ", category: "ETF" },
  { symbol: "SQQQ", koreanName: "나스닥3배인버스", englishName: "ProShares UltraPro Short QQQ", category: "ETF" },
  { symbol: "XLF", koreanName: "금융섹터ETF", englishName: "Financial Select Sector SPDR", category: "ETF" },
  { symbol: "XLK", koreanName: "기술섹터ETF", englishName: "Technology Select Sector SPDR", category: "ETF" },
  { symbol: "XLE", koreanName: "에너지섹터ETF", englishName: "Energy Select Sector SPDR", category: "ETF" },
  { symbol: "XLV", koreanName: "헬스케어섹터ETF", englishName: "Health Care Select Sector SPDR", category: "ETF" },
  { symbol: "GLD", koreanName: "금ETF", englishName: "SPDR Gold Shares", category: "ETF", aliases: ["골드"] },
  { symbol: "SLV", koreanName: "은ETF", englishName: "iShares Silver Trust", category: "ETF", aliases: ["실버"] },
  { symbol: "TLT", koreanName: "미국장기국채ETF", englishName: "iShares 20+ Year Treasury", category: "ETF" },
  { symbol: "HYG", koreanName: "하이일드채권ETF", englishName: "iShares High Yield Corporate Bond", category: "ETF" },
  { symbol: "VNQ", koreanName: "부동산ETF", englishName: "Vanguard Real Estate", category: "ETF" },
  { symbol: "EEM", koreanName: "신흥국ETF", englishName: "iShares MSCI Emerging Markets", category: "ETF" },
  { symbol: "EWY", koreanName: "한국ETF", englishName: "iShares MSCI South Korea", category: "ETF" },
  { symbol: "FXI", koreanName: "중국ETF", englishName: "iShares China Large-Cap", category: "ETF" },

  // ===== 추가 산업/기술 =====
  { symbol: "IBM", koreanName: "아이비엠", englishName: "IBM", category: "IT" },
  { symbol: "CSCO", koreanName: "시스코", englishName: "Cisco Systems", category: "IT" },
  { symbol: "ACN", koreanName: "액센추어", englishName: "Accenture", category: "컨설팅" },
  { symbol: "DELL", koreanName: "델테크놀로지스", englishName: "Dell Technologies", category: "IT" },
  { symbol: "HPQ", koreanName: "에이치피", englishName: "HP Inc", category: "IT" },
  { symbol: "ANET", koreanName: "아리스타네트웍스", englishName: "Arista Networks", category: "IT" },
  { symbol: "MSI", koreanName: "모토로라솔루션즈", englishName: "Motorola Solutions", category: "IT" },
  { symbol: "SNPS", koreanName: "시놉시스", englishName: "Synopsys", category: "반도체" },
  { symbol: "CDNS", koreanName: "케이던스", englishName: "Cadence Design Systems", category: "반도체" },
  { symbol: "ANSS", koreanName: "앤시스", englishName: "Ansys", category: "소프트웨어" },
  { symbol: "FICO", koreanName: "페어아이작", englishName: "Fair Isaac", category: "핀테크", aliases: ["피코"] },
  { symbol: "MNDY", koreanName: "먼데이닷컴", englishName: "Monday.com", category: "SaaS" },
  { symbol: "GRAB", koreanName: "그랩", englishName: "Grab Holdings", category: "모빌리티" },
  { symbol: "RIVN", koreanName: "리비안", englishName: "Rivian Automotive", category: "전기차" },

  // ===== 럭셔리 / 기타 =====
  { symbol: "LVMUY", koreanName: "루이비통", englishName: "LVMH", category: "럭셔리", aliases: ["루이비통모에헤네시"] },

  // ===== 소형주 / 페니스톡 (Penny Stocks) =====
  // -- 전기차 / 모빌리티 --
  { symbol: "GOEV", koreanName: "카누", englishName: "Canoo", category: "전기차" },
  { symbol: "FFIE", koreanName: "파라데이퓨처", englishName: "Faraday Future", category: "전기차" },
  { symbol: "MULN", koreanName: "멀렌오토모티브", englishName: "Mullen Automotive", category: "전기차" },
  { symbol: "WKHS", koreanName: "워크호스", englishName: "Workhorse Group", category: "전기차" },
  { symbol: "NKLA", koreanName: "니콜라", englishName: "Nikola", category: "전기차" },
  { symbol: "ARVL", koreanName: "어라이벌", englishName: "Arrival", category: "전기차" },
  { symbol: "CENN", koreanName: "센엔버젼", englishName: "Cenntro Electric", category: "전기차" },
  { symbol: "XOS", koreanName: "조스트럭스", englishName: "Xos Trucks", category: "전기차" },
  { symbol: "HYLN", koreanName: "하일리온", englishName: "Hyliion", category: "전기차" },

  // -- EV 충전 --
  { symbol: "CHPT", koreanName: "차지포인트", englishName: "ChargePoint", category: "EV충전" },
  { symbol: "EVGO", koreanName: "이브고", englishName: "EVgo", category: "EV충전" },
  { symbol: "BLNK", koreanName: "블링크차징", englishName: "Blink Charging", category: "EV충전" },
  { symbol: "BEEM", koreanName: "빔글로벌", englishName: "Beam Global", category: "EV충전" },

  // -- 수소 / 연료전지 --
  { symbol: "FCEL", koreanName: "퓨얼셀에너지", englishName: "FuelCell Energy", category: "수소" },
  { symbol: "PLUG", koreanName: "플러그파워", englishName: "Plug Power", category: "수소" },

  // -- 대마 (Cannabis) --
  { symbol: "SNDL", koreanName: "선다이얼", englishName: "SNDL (Sundial)", category: "대마" },
  { symbol: "TLRY", koreanName: "틸레이", englishName: "Tilray", category: "대마" },
  { symbol: "ACB", koreanName: "오로라캐나비스", englishName: "Aurora Cannabis", category: "대마" },
  { symbol: "CGC", koreanName: "캐노피그로스", englishName: "Canopy Growth", category: "대마" },
  { symbol: "MNMD", koreanName: "마인드메드", englishName: "MindMed", category: "바이오" },

  // -- 바이오 / 헬스케어 소형 --
  { symbol: "SENS", koreanName: "센서니스트", englishName: "Senseonics", category: "의료기기" },
  { symbol: "GNUS", koreanName: "지니어스브랜즈", englishName: "Genius Brands", category: "엔터" },
  { symbol: "BNGO", koreanName: "바이오나노", englishName: "Bionano Genomics", category: "바이오" },
  { symbol: "CLVS", koreanName: "클로비스", englishName: "Clovis Oncology", category: "바이오" },
  { symbol: "DNA", koreanName: "기킨고", englishName: "Ginkgo Bioworks", category: "바이오" },
  { symbol: "ME", koreanName: "23앤드미", englishName: "23andMe", category: "바이오", aliases: ["투쓰리앤드미"] },
  { symbol: "SDC", koreanName: "스마일다이렉트", englishName: "SmileDirectClub", category: "헬스케어" },
  { symbol: "CLOV", koreanName: "클로버헬스", englishName: "Clover Health", category: "헬스케어" },
  { symbol: "HIMS", koreanName: "힘스앤허스", englishName: "Hims & Hers Health", category: "헬스케어" },
  { symbol: "IBRX", koreanName: "이뮤노브리지", englishName: "ImmunityBio", category: "바이오" },
  { symbol: "CANO", koreanName: "카노헬스", englishName: "Cano Health", category: "헬스케어" },
  { symbol: "NUVB", koreanName: "누바시스", englishName: "Nuvation Bio", category: "바이오" },

  // -- 핀테크 / 커머스 소형 --
  { symbol: "PSFE", koreanName: "페이세이프", englishName: "Paysafe", category: "핀테크" },
  { symbol: "WISH", koreanName: "위시", englishName: "ContextLogic (Wish)", category: "커머스" },
  { symbol: "SKLZ", koreanName: "스킬즈", englishName: "Skillz", category: "게임" },
  { symbol: "OPEN", koreanName: "오픈도어", englishName: "Opendoor Technologies", category: "부동산테크" },
  { symbol: "LMND", koreanName: "레모네이드", englishName: "Lemonade", category: "인슈어테크" },
  { symbol: "BYND", koreanName: "비욘드미트", englishName: "Beyond Meat", category: "대체식품" },
  { symbol: "BKKT", koreanName: "백트", englishName: "Bakkt Holdings", category: "크립토" },
  { symbol: "PAYO", koreanName: "페이어니어", englishName: "Payoneer Global", category: "핀테크" },

  // -- 우주 / 항공 --
  { symbol: "ASTS", koreanName: "에이에스티스페이스", englishName: "AST SpaceMobile", category: "우주" },
  { symbol: "RKLB", koreanName: "로켓랩", englishName: "Rocket Lab", category: "우주" },
  { symbol: "LUNR", koreanName: "인튜이티브머신즈", englishName: "Intuitive Machines", category: "우주" },
  { symbol: "JOBY", koreanName: "조비에비에이션", englishName: "Joby Aviation", category: "항공" },
  { symbol: "RDW", koreanName: "레드와이어", englishName: "Redwire", category: "우주" },

  // -- 양자컴퓨터 --
  { symbol: "QUBT", koreanName: "큐비트테크", englishName: "Quantum Computing", category: "양자컴퓨터" },
  { symbol: "QBTS", koreanName: "디웨이브양자", englishName: "D-Wave Quantum", category: "양자컴퓨터" },
  { symbol: "ARQQ", koreanName: "아르키트퀀텀", englishName: "Arqit Quantum", category: "양자컴퓨터" },

  // -- 크립토 마이닝 --
  { symbol: "BITF", koreanName: "비트팜스", englishName: "Bitfarms", category: "크립토" },
  { symbol: "HUT", koreanName: "허트에이트", englishName: "Hut 8 Mining", category: "크립토" },
  { symbol: "WULF", koreanName: "테라울프", englishName: "TeraWulf", category: "크립토" },

  // -- 광물 / 금 --
  { symbol: "BTG", koreanName: "B2골드", englishName: "B2Gold", category: "금광" },
  { symbol: "FSM", koreanName: "포르투나실버", englishName: "Fortuna Silver Mines", category: "은광" },
  { symbol: "GPL", koreanName: "그레이트팬써실버", englishName: "Great Panther Silver", category: "은광" },
  { symbol: "GATO", koreanName: "갈로실버", englishName: "Gatos Silver", category: "은광" },
  { symbol: "USAS", koreanName: "아메리카스골드", englishName: "Americas Gold and Silver", category: "금광" },
  { symbol: "UEC", koreanName: "유라니움에너지", englishName: "Uranium Energy", category: "우라늄" },

  // -- 통신 / 레거시 --
  { symbol: "QS", koreanName: "퀀텀스케이프", englishName: "QuantumScape", category: "배터리" },
  { symbol: "SIRI", koreanName: "시리우스XM", englishName: "Sirius XM", category: "엔터" },
  { symbol: "NOK", koreanName: "노키아", englishName: "Nokia", category: "통신" },
  { symbol: "BB", koreanName: "블랙베리", englishName: "BlackBerry", category: "보안" },
  { symbol: "TELL", koreanName: "텔루리안", englishName: "Tellurian", category: "에너지" },
  { symbol: "GSAT", koreanName: "글로벌스타", englishName: "Globalstar", category: "통신" },

  // -- 자율주행 / 라이다 --
  { symbol: "LAZR", koreanName: "루미나테크", englishName: "Luminar Technologies", category: "라이다" },
  { symbol: "MVIS", koreanName: "마이크로비전", englishName: "MicroVision", category: "라이다" },
  { symbol: "LIDR", koreanName: "에이아이라이다", englishName: "AEye (Lidar)", category: "라이다" },
  { symbol: "OUST", koreanName: "아우스터", englishName: "Ouster", category: "라이다" },
  { symbol: "AEVA", koreanName: "에바테크", englishName: "Aeva Technologies", category: "라이다" },

  // -- 3D프린팅 / 제조 --
  { symbol: "DM", koreanName: "데스크톱메탈", englishName: "Desktop Metal", category: "3D프린팅" },
  { symbol: "NNDM", koreanName: "나노디멘션", englishName: "Nano Dimension", category: "3D프린팅" },
  { symbol: "VLD", koreanName: "벨로3D", englishName: "Velo3D", category: "3D프린팅" },

  // -- 에너지 / 클린테크 --
  { symbol: "STEM", koreanName: "스템", englishName: "Stem Inc", category: "에너지저장" },
  { symbol: "EOSE", koreanName: "이오스에너지", englishName: "Eos Energy", category: "에너지저장" },
  { symbol: "FLNC", koreanName: "플루언스에너지", englishName: "Fluence Energy", category: "에너지저장" },
  { symbol: "SHLS", koreanName: "쇼울스테크", englishName: "Shoals Technologies", category: "태양광" },
  { symbol: "TPIC", koreanName: "TPI컴포지트", englishName: "TPI Composites", category: "풍력" },
  { symbol: "ORGN", koreanName: "오리진머티리얼즈", englishName: "Origin Materials", category: "클린테크" },
  { symbol: "AMPX", koreanName: "앰프리우스", englishName: "Amprius Technologies", category: "배터리" },
  { symbol: "ENVX", koreanName: "에노비스", englishName: "Enovix", category: "배터리" },

  // -- 소프트웨어 / SaaS 소형 --
  { symbol: "KULR", koreanName: "쿨러테크", englishName: "KULR Technology", category: "기술" },
  { symbol: "YEXT", koreanName: "옉스트", englishName: "Yext", category: "SaaS" },
  { symbol: "ZETA", koreanName: "제타글로벌", englishName: "Zeta Global", category: "SaaS" },
  { symbol: "MAPS", koreanName: "와이맵스", englishName: "WM Technology", category: "대마테크" },
  { symbol: "TRMR", koreanName: "트레머비디오", englishName: "Tremor International", category: "광고" },
  { symbol: "WRAP", koreanName: "랩테크놀로지스", englishName: "Wrap Technologies", category: "보안" },
  { symbol: "KORE", koreanName: "코어와이어리스", englishName: "KORE Wireless", category: "IoT" },
  { symbol: "GLS", koreanName: "젤리시스", englishName: "Gelesis", category: "헬스케어" },
  { symbol: "VNET", koreanName: "브이넷그룹", englishName: "VNET Group", category: "클라우드" },
];

// ===== 동의어 검색용 인덱스 빌드 =====
const _aliasIndex = new Map<string, string[]>();
KOREAN_STOCK_MAP.forEach(entry => {
  if (entry.aliases) {
    entry.aliases.forEach(alias => {
      const key = alias.toLowerCase();
      const existing = _aliasIndex.get(key) || [];
      existing.push(entry.symbol);
      _aliasIndex.set(key, existing);
    });
  }
});

/**
 * 심볼로 한국어 종목명 조회
 * 없으면 null 반환
 */
const _symbolIndex = new Map<string, KoreanStockEntry>();
KOREAN_STOCK_MAP.forEach(entry => {
  _symbolIndex.set(entry.symbol, entry);
});

export function getKoreanName(symbol: string): string | null {
  return _symbolIndex.get(symbol)?.koreanName ?? null;
}

export function getKoreanEntry(symbol: string): KoreanStockEntry | null {
  return _symbolIndex.get(symbol) ?? null;
}

/**
 * 심볼을 "한글명 (TICKER)" 형식으로 포맷
 * 매핑 없으면 심볼만 반환
 */
export function formatStockName(symbol: string): string {
  const name = getKoreanName(symbol);
  return name ? `${name} (${symbol})` : symbol;
}

// ===== 초성 매핑 테이블 =====
const CHOSUNG_MAP: Record<string, string> = {
  'ㄱ': '가', 'ㄲ': '까', 'ㄴ': '나', 'ㄷ': '다', 'ㄸ': '따',
  'ㄹ': '라', 'ㅁ': '마', 'ㅂ': '바', 'ㅃ': '빠', 'ㅅ': '사',
  'ㅆ': '싸', 'ㅇ': '아', 'ㅈ': '자', 'ㅉ': '짜', 'ㅊ': '차',
  'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하',
};
const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChosung(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  const idx = Math.floor((code - 0xAC00) / (21 * 28));
  return CHOSUNG_LIST[idx] || null;
}

function extractChosung(str: string): string {
  return str.split('').map(c => getChosung(c) || c).join('');
}

function isChosungOnly(str: string): boolean {
  return str.split('').every(c => CHOSUNG_LIST.includes(c));
}

// ===== 퍼지 매칭 (유사 키워드) =====
const FUZZY_ALIASES: Record<string, string[]> = {
  'NVDA': ['엔비듸아', '엔디비아', '엔비디야', '엔비듀아', '엔비디아주식', 'nvidia주식'],
  'TSLA': ['테슬러', '텟슬라', '테스라', '테슬라주식', '일론', '일론머스크주식'],
  'AAPL': ['애플주식', '에플', '아이폰주식', '애플컴퓨터', '맥북주식'],
  'MSFT': ['마소', '마이크로소프트주식', '윈도우주식', 'ms주식'],
  'AMZN': ['아마존주식', '아마죤', 'aws주식'],
  'META': ['메타주식', '페북', '인스타주식', '페이스북주식', '인스타그램주식'],
  'GOOGL': ['구글주식', '구굴', '유튜브주식', '알파벳주식'],
  'AMD': ['에이엠디주식', 'amd주식', '라이젠'],
  'INTC': ['인텔주식', '인텔반도체'],
  'COIN': ['코인베이스주식', '코베'],
  'PLTR': ['팔란티어주식', '팔란티어테크'],
  'NIO': ['니오주식', '니오전기차'],
  'RIVN': ['리비안주식', '리비안전기차'],
  'SOFI': ['소파이주식', '소파이테크'],
  'LCID': ['루시드주식', '루시드모터스'],
  'MSTR': ['마이크로스트래티지주식', '비트코인주식'],
  'BA': ['보잉주식', '보잉항공'],
  'DIS': ['디즈니주식', '디즈니플러스주식', '월트디즈니주식'],
  'NFLX': ['넷플릭스주식', '넷플주식', '넷플'],
  'JPM': ['제이피모건주식', 'jp모건'],
  'V': ['비자주식', '비자카드'],
  'MA': ['마스터카드주식', '마카'],
  'PYPL': ['페이팔주식', '페이팔결제'],
  'SQ': ['스퀘어주식', '블록주식', '블럭'],
  'SHOP': ['쇼피파이주식', '쇼피'],
  'UBER': ['우버주식', '우버택시'],
  'ABNB': ['에어비앤비주식', '에비비'],
  'SBUX': ['스타벅스주식', '스벅'],
  'MCD': ['맥도날드주식', '맥날'],
  'KO': ['코카콜라주식', '콜라주식'],
  'WMT': ['월마트주식'],
  'COST': ['코스트코주식'],
  'JNJ': ['존슨앤존슨주식', '존존'],
  'PFE': ['화이자주식', '화이자백신'],
  'MRNA': ['모더나주식', '모더나백신'],
  'LLY': ['일라이릴리주식', '릴리', '위고비주식'],
  'NVO': ['노보노디스크주식', '오젬픽주식', '위고비'],
  'XOM': ['엑슨모빌주식', '엑손'],
  'CVX': ['쉐브론주식', '셰브론'],
  'LMT': ['록히드마틴주식', '록마'],
  'CRM': ['세일즈포스주식'],
  'SNOW': ['스노우플레이크주식'],
  'CRWD': ['크라우드스트라이크주식', '크스'],
  'ARM': ['암홀딩스주식', '에이알엠주식', 'arm주식'],
  'TSM': ['tsmc주식', '대만반도체주식'],
  'ASML': ['asml주식', '에이에스엠엘주식'],
  'BRK.B': ['버크셔주식', '워런버핏주식', '버핏'],
  'AVGO': ['브로드컴주식'],
  'LIN': ['린데주식'],
  'SPY': ['에스피와이', 'spy주식', 'S&P500'],
  'QQQ': ['큐큐큐', 'qqq주식', '나스닥etf'],
  'TQQQ': ['삼큐', '나스닥3배'],
  'SOXL': ['삭슬', '반도체3배'],
  'ARKK': ['아크주식', '캐시우드주식'],
  'IONQ': ['아이온큐주식', '양자컴퓨터주식'],
};

// Build fuzzy index
const _fuzzyIndex = new Map<string, string>();
Object.entries(FUZZY_ALIASES).forEach(([symbol, aliases]) => {
  aliases.forEach(alias => _fuzzyIndex.set(alias.toLowerCase(), symbol));
});

/**
 * 한글 또는 영어 입력으로 종목 검색
 * - 초성 검색 (ㅌㅅㄹ → 테슬라)
 * - 퍼지 매칭 (엔비듸아 → NVDA)
 * - 한글 종목명 (부분 일치)
 * - 동의어/별칭 매칭
 * - 티커 (대소문자 무관)
 * - 영어 회사명 (부분 일치)
 * - 카테고리 검색
 */
export function searchKoreanStocks(query: string): KoreanStockEntry[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();

  // 0) 퍼지 매칭 체크
  const fuzzySymbol = _fuzzyIndex.get(q);
  if (fuzzySymbol) {
    const entry = _symbolIndex.get(fuzzySymbol);
    if (entry) return [entry];
  }

  // 0b) 초성 검색
  const isChosung = isChosungOnly(q);

  // 1) 동의어 매칭 결과 수집
  const aliasMatches = new Set<string>();
  _aliasIndex.forEach((symbols, alias) => {
    if (alias.includes(q)) {
      symbols.forEach(s => aliasMatches.add(s));
    }
  });

  // 2) 메인 필터
  const results: KoreanStockEntry[] = [];
  const seen = new Set<string>();

  // 정확한 티커 매치 우선
  KOREAN_STOCK_MAP.forEach(entry => {
    if (entry.symbol.toLowerCase() === q && !seen.has(entry.symbol)) {
      results.push(entry);
      seen.add(entry.symbol);
    }
  });

  // 초성 매칭
  if (isChosung && q.length >= 2) {
    KOREAN_STOCK_MAP.forEach(entry => {
      if (seen.has(entry.symbol)) return;
      const nameChosung = extractChosung(entry.koreanName);
      if (nameChosung.startsWith(q)) {
        results.push(entry);
        seen.add(entry.symbol);
      }
    });
  }

  // 한글 이름 매칭
  KOREAN_STOCK_MAP.forEach(entry => {
    if (seen.has(entry.symbol)) return;
    if (entry.koreanName.toLowerCase().includes(q)) {
      results.push(entry);
      seen.add(entry.symbol);
    }
  });

  // 동의어 매칭
  aliasMatches.forEach(symbol => {
    if (seen.has(symbol)) return;
    const entry = _symbolIndex.get(symbol);
    if (entry) {
      results.push(entry);
      seen.add(symbol);
    }
  });

  // 티커 부분 매칭
  KOREAN_STOCK_MAP.forEach(entry => {
    if (seen.has(entry.symbol)) return;
    if (entry.symbol.toLowerCase().includes(q)) {
      results.push(entry);
      seen.add(entry.symbol);
    }
  });

  // 영문명 매칭
  KOREAN_STOCK_MAP.forEach(entry => {
    if (seen.has(entry.symbol)) return;
    if (entry.englishName.toLowerCase().includes(q)) {
      results.push(entry);
      seen.add(entry.symbol);
    }
  });

  // 카테고리 매칭
  KOREAN_STOCK_MAP.forEach(entry => {
    if (seen.has(entry.symbol)) return;
    if (entry.category?.toLowerCase().includes(q)) {
      results.push(entry);
      seen.add(entry.symbol);
    }
  });

  return results.slice(0, 20);
}
