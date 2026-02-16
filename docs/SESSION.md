# v2doc 개발 세션 상태

> 이 파일은 Claude Code가 작업을 재개할 때 컨텍스트를 빠르게 파악하기 위한 파일입니다.

---

## 마지막 세션 정보

| 항목 | 값 |
|------|-----|
| **날짜** | 2026-02-12 |
| **세션 ID** | session-013 |
| **완료한 작업** | v1.0.0 리브랜딩 + API 인증/문서화 + 프로덕션 배포 검증 |
| **다음 작업** | Phase 3: Orchestrator 파이프라인 리팩토링 (3.0~3.3) 또는 플레이리스트 지원 |

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

## 최근 완료한 작업: v1.0.0 리브랜딩 + API 인증/문서화

### 커밋 정보
- **기간**: 2026-02-09 ~ 2026-02-12
- **세션**: session-012 ~ session-013
- **상태**: 빌드/테스트 통과 (928개)

### 구현 내용

#### 1. 프록시 제어 옵션 (session-012) ✅
- `--force-proxy`, `--trace` CLI 옵션 추가
- 스크린샷 옵션 단순화 (-q 플래그로 통합)
- 커밋: 9e72e4c, bd3a9c2, 09c1b05, c237963

#### 2. API 문서화 (session-012) ✅
- OpenAPI 스펙 + Scalar UI 문서화
- API 배포 검증 테스트 스위트
- OpenAPI 의존성 추가 (package.api.json)
- 커밋: c237963, 27bea58, 6bf3b20

#### 3. v1.0.0 리브랜딩 (session-013) ✅
- yt2pdf → v2doc 전면 리네이밍
- API Key 인증 + Rate Limiting 추가
- 로컬 API E2E 테스트 + output 폴더 통합
- Dockerfile 설정 파일 옵션화
- OpenAPI 서버 URL 동적화
- 프록시 디버그 정보 API 응답 추가
- 커밋: 6a631c1, 1e9e738, 24a0ebe, 8247c85, 143a391, 9fde43e, 34aac65

#### 4. 프로덕션 검증 (session-013) ✅
- 프로덕션 API 테스트 스크립트 (`scripts/test-api-prod.sh`)
- 하드코딩된 API 키 보안 수정
- 커밋: f0bb2e0, 9e0366b, 2dc8145

### 테스트 현황
- **전체 테스트**: 928개 통과
- **빌드**: 0 에러
- **린트**: 0 에러
- **순환 의존성**: 0개
- **E2E**: API 플로우 + 프로덕션 배포 검증 포함

---

## 다음 작업 (session-014)

### 리팩토링 Phase 3: Orchestrator 파이프라인 리팩토링
> **계획 문서**: `.omc/plans/remaining-tasks-plan.md`

1. **파이프라인 인터페이스 정의 (3.0)**
   - `src/core/pipeline/interfaces.ts` 생성
   - PipelineStage, PipelineContext, PipelineResult 정의

2. **파이프라인 스테이지 추출 (3.1)**
   - Orchestrator 915줄 → 6개 스테이지 + Coordinator
   - 특성 테스트로 동작 보호

3. **AI Provider 정리 (3.2)**
   - ai.ts와 unified-ai.ts 중복 제거

4. **통합 테스트 추가 (3.3)**
   - Pipeline 스테이지 통합 테스트

### 또는: 플레이리스트 지원 (Phase 3.1)
- 3.1.1 플레이리스트 파싱
- 3.1.2 배치 처리 로직
- 3.1.3 플레이리스트 UI

### 검증 방법
```bash
npm run verify:all  # 전체 6-layer 검증
```

### 블로커 (별도 해결 필요)
- **YouTube IP Blocking**: 프록시 URL 검증 구현 완료. Cloud Run 배포 시 프록시 서비스 구독 필요.

---

## 이전 세션 기록

### session-013 (2026-02-09~2026-02-12): v1.0.0 리브랜딩 + API 인증
- yt2pdf → v2doc 리네이밍 (v1.0.0)
- API Key 인증 + Rate Limiting
- 프로덕션 API 테스트 스크립트
- 928개 테스트 통과

### session-012 (2026-02-09): 프록시 옵션 + API 문서화
- forceProxy, trace 옵션 추가
- 스크린샷 옵션 단순화
- OpenAPI Scalar UI 문서화
- API 배포 검증 테스트

### session-011 (2026-02-08): Orchestrator 특성 테스트 + 프록시 검증
- Orchestrator 특성 테스트 33개
- YouTube 프록시 URL 검증 구현
- 876개 테스트 통과

### session-010 (2026-02-06): 리팩토링 Phase 2 완료
- PDF Generator 4개 모듈로 분해 완료
- 825개 테스트 통과

### session-009 (2026-02-06): 리팩토링 Phase 1 완료
- 4개 유틸리티 모듈 추출 (text-normalizer, image, language, time)
- 784개 테스트 통과, 새 모듈 90%+ 커버리지
- 의존성 그래프 정리, 모듈 응집도 향상

### session-008 (2026-02-06): 리팩토링 Phase 0 완료
- 6-layer 검증 전략 인프라 구축
- PDFKit mock, 테스트 픽스처, 시각적 회귀 테스트 설정
- 693개 테스트 통과, 빌드/린트 0 에러

### session-007 (2026-02-06): Token 최적화 + ESLint 정리
- translatedText 필드 제거로 토큰 최적화
- ESLint 627개 에러 → 0개로 정리
- RALPLAN으로 리팩토링 계획 수립

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
v2doc https://youtube.com/watch?v=... --summary --translate

# 영어로 번역
v2doc https://youtube.com/watch?v=... --translate --target-lang en
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
- 프로젝트: `./v2doc.config.yaml`
- 전역: `~/.config/v2doc/config.yaml`

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
| 2026-02-12 | v1.0.0 리브랜딩 + API 인증/문서화 (session-013) |
| 2026-02-09 | 프록시 옵션 + OpenAPI 문서화 (session-012) |
| 2026-02-08 | Orchestrator 특성 테스트 + 프록시 검증 구현 (session-011) |
| 2026-02-06 | 리팩토링 Phase 2 완료 - PDF Generator 분해 (session-010) |
| 2026-02-06 | 리팩토링 Phase 1 완료 - 유틸리티 추출 (session-009) |
| 2026-02-06 | 리팩토링 Phase 0 완료 - 테스트 인프라 구축 (session-008) |
| 2026-02-06 | Token 최적화 + ESLint 정리 + 리팩토링 계획 수립 (session-007) |
| 2026-02-04 | Cloud Run + GCS 배포 설계 및 구현 |
| 2026-02-02 | Web Service API + 클라우드 프로바이더 추상화 |
| 2026-01-30 | PDF 품질 개선 + AI 프롬프트 재설계 |
| 2025-01-29 | PDF 품질 개선 (폰트, 자막, 번역) |
| 2025-01-28 | AI 요약, 섹션 요약, 썸네일 추가 |
| 2025-01-27 | AI 기능 구현 (요약 + 번역) |
| 2025-01-26 | 200개 개선사항 적용 |
| 2025-01-26 | 초기 세션 생성, 설계 문서 완료 |

---

---

## 현재 Phase 상태

- **Phase 7: 코드베이스 리팩토링 + API 완성** (🔄 진행 중)
  - Phase 0: ✅ 완료 (테스트 인프라)
  - Phase 1: ✅ 완료 (유틸리티 추출)
  - Phase 2: ✅ 완료 (PDF Generator 분해)
  - Phase 3: ⬜ 대기 (Orchestrator 파이프라인 리팩토링)
  - v1.0.0 리브랜딩: ✅ 완료 (yt2pdf → v2doc)
  - API 인증/문서화: ✅ 완료 (API Key + OpenAPI)

---

*마지막 업데이트: 2026-02-13 (session-013 기록 갱신)*
