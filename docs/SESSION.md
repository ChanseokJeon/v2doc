# yt2pdf 개발 세션 상태

> 이 파일은 Claude Code가 작업을 재개할 때 컨텍스트를 빠르게 파악하기 위한 파일입니다.

---

## 마지막 세션 정보

| 항목 | 값 |
|------|-----|
| **날짜** | 2026-02-06 |
| **세션 ID** | session-007 |
| **완료한 작업** | Token 최적화 + yt-dlp Proxy 지원 + Cloud Run 배포 (IP Blocking 실패) |
| **다음 작업** | Residential Proxy 설정 + ESLint 정리 |

---

## 프로젝트 컨텍스트

### 프로젝트 목적
YouTube 영상의 자막과 스크린샷을 추출하여 PDF로 변환하는 CLI + Web Service

### 핵심 기술 결정
- **언어**: Node.js / TypeScript
- **자막**: YouTube 자막 우선, Whisper API 폴백
- **스크린샷**: FFmpeg, 1분 간격, 480p
- **설정**: YAML
- **사용 형태**: CLI + Claude Code Skill + **Web API**
- **AI 기능**: OpenAI GPT (요약, 번역)
- **API 프레임워크**: Hono
- **배포**: Cloud Run (동기 처리) + GCS (Signed URL, 7일 만료)

### 문서 구조
```
docs/
├── ARCHITECTURE.md         # 전체 아키텍처, 데이터 흐름
├── MODULES.md              # 각 모듈 상세 설계, 인터페이스
├── PROGRESS.md             # 마일스톤별 태스크 상태
├── SESSION.md              # 세션 상태 (이 파일)
├── WEB-API-ARCHITECTURE.md # Web API 시스템 아키텍처
├── ISSUE_REVIEW_REPORT.md  # 보안/안정성 리뷰
└── JOBSTORE_PERSISTENCE.md # Redis/SQLite 마이그레이션 가이드
```

---

## 최근 완료한 작업: Token 최적화 + yt-dlp Proxy + Cloud Run 배포

### 커밋 정보
- **최근 커밋**: `8626d4b` (2026-02-05)
- **변경**: 패키지 관리 업데이트 (package.json, package-lock.json)
- **상태**: Working tree clean (모든 변경 커밋됨)

### 구현 내용

#### 1. Token 최적화 (session-007)
- **변경**: `translatedText` 필드 제거
- **효과**: API 응답 크기 감소, token 사용량 최적화
- **현황**: 패키지 업데이트 완료

#### 2. yt-dlp Proxy 지원 추가
- **목적**: YouTube IP blocking 우회
- **구현**: `--proxy` 옵션 지원 (Basic/SOCKS5)
- **테스트**: Cloud Run 배포 시도 → YouTube IP blocking으로 실패
- **결론**: Proxy 설정만으로는 불충분, residential proxy 필요

#### 3. Cloud Run 배포 실패 분석
- **증상**: Cloud Run에서 YouTube 액세스 불가 (429 Too Many Requests)
- **원인**: YouTube의 클라우드 IP 차단
- **해결책**: Residential proxy (다음 세션) 또는 on-premise 배포 검토

#### 4. 기존 시스템 안정성
- **REST API**: Hono 프레임워크 (Job 관리, 상태 추적)
- **클라우드 추상화**: AWS/GCP/Local 지원
- **보안 수정**: 완료 (Injection, Path Traversal, NACK 버그 등)
- **테스트**: 596개 테스트, 94%+ 커버리지

---

## 다음 작업 (session-008)

### 긴급: YouTube IP Blocking 해결
1. **Residential Proxy 설정**
   - Proxy provider 평가 (Bright Data, Oxylabs, Smart Proxy 등)
   - yt-dlp proxy 설정 통합
   - 비용 분석 및 선택

2. **배포 전략 재검토**
   - Cloud Run (proxy 솔루션 후)
   - On-premise 배포 (dedicated server)
   - Hybrid 접근법

### 코드 정리
1. **ESLint 규칙 정리**
   - 현재 ESLint 정책 검토
   - 일관되지 않은 규칙 정정
   - 빌드 경고 해결

### 프로덕션 배포 준비 (이후)
1. **JobStore 영속화**: In-memory → Redis 또는 SQLite
2. **인증/인가**: API Key 또는 OAuth 추가
3. **Rate Limiting**: 요청 제한
4. **CI/CD**: GitHub Actions 배포 파이프라인

---

## 이전 세션 기록

### session-006 (2026-02-04): Cloud Run + GCS 배포
- Cloud Run + GCS 배포 설계 및 구현
- 빌드 및 기본 배포 테스트

### session-005 (2026-02-02): Web Service API + 클라우드 추상화
- REST API (Hono 프레임워크) 구현
- AWS/GCP/Local 클라우드 프로바이더 추상화
- 596개 테스트, 94%+ 커버리지

### session-004 (2026-01-30): PDF 품질 개선
- PDF 중복 콘텐츠 문제 해결
- AI 프롬프트 재설계 (TASK A/B/C 분리)
- 157개 테스트 통과

---

## 빠른 참조

### CLI 사용 방법

```bash
# 환경변수 설정
export OPENAI_API_KEY=sk-...

# 요약 + 번역 활성화
yt2pdf https://youtube.com/watch?v=... --summary --translate

# 영어로 번역
yt2pdf https://youtube.com/watch?v=... --translate --target-lang en
```

### Web API 사용 방법

```bash
# 서버 시작
npm run api:start

# Job 생성
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=..."}'

# Job 상태 확인
curl http://localhost:3000/api/v1/jobs/{jobId}
```

### 설정 파일 경로
- 프로젝트: `./yt2pdf.config.yaml`
- 전역: `~/.config/yt2pdf/config.yaml`

### 클라우드 프로바이더 설정
```bash
# AWS
export CLOUD_PROVIDER=aws
export AWS_REGION=us-east-1

# GCP
export CLOUD_PROVIDER=gcp
export GCP_PROJECT_ID=your-project

# Local (기본값)
export CLOUD_PROVIDER=local
```

---

## 주의사항

1. **API 키 필수**: AI 기능 사용시 OPENAI_API_KEY 필요
2. **비용 발생**: GPT-4o-mini API 호출시 비용 발생
3. **외부 의존성**: ffmpeg, yt-dlp는 별도 설치 필요
4. **JobStore**: 현재 In-memory (프로덕션 전 Redis 전환 필요)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-06 | Token 최적화 + yt-dlp Proxy 지원 + Cloud Run 배포 (IP Blocking 실패) |
| 2026-02-04 | Cloud Run + GCS 배포 설계 및 구현 |
| 2026-02-02 | Web Service API + 클라우드 프로바이더 추상화 |
| 2026-01-30 | PDF 품질 개선 + AI 프롬프트 재설계 |
| 2025-01-29 | PDF 품질 개선 (폰트, 자막, 번역) |
| 2025-01-28 | AI 요약, 섹션 요약, 썸네일 추가 |
| 2025-01-27 | AI 기능 구현 (요약 + 번역) |
| 2025-01-26 | 200개 개선사항 적용 |
| 2025-01-26 | 초기 세션 생성, 설계 문서 완료 |

---

*마지막 업데이트: 2026-02-06*
