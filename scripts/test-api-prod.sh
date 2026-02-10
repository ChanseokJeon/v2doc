#!/bin/bash

##############################################################################
# v2doc API Production Test Script
#
# Cloud Run 프로덕션 서버를 테스트합니다. (서버는 이미 실행 중)
#
# Usage:
#   ./scripts/test-api-prod.sh [BASE_URL] [VIDEO_URL]
#   V2DOC_API_KEY=xxx ./scripts/test-api-prod.sh
#   V2DOC_API_KEY=xxx V2DOC_BASE_URL=xxx ./scripts/test-api-prod.sh
#
# Examples:
#   ./scripts/test-api-prod.sh
#   ./scripts/test-api-prod.sh https://v2doc-xxx.run.app
#   ./scripts/test-api-prod.sh https://v2doc-xxx.run.app "https://www.youtube.com/watch?v=VIDEO_ID"
#   V2DOC_API_KEY=custom_key ./scripts/test-api-prod.sh
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_BASE_URL="https://v2doc-941839241915.asia-northeast3.run.app"
DEFAULT_API_KEY="REDACTED"
DEFAULT_VIDEO_URL="https://www.youtube.com/watch?v=jNQXAC9IVRw" # "Me at the zoo" (18s)

BASE_URL="${V2DOC_BASE_URL:-${1:-$DEFAULT_BASE_URL}}"
TEST_VIDEO_URL="${2:-$DEFAULT_VIDEO_URL}"
API_KEY="${V2DOC_API_KEY:-$DEFAULT_API_KEY}"
OUTPUT_DIR="./output/api-prod-test"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}v2doc API Production Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "   Base URL: ${BLUE}${BASE_URL}${NC}"
echo -e "   API Key: ${BLUE}${API_KEY:0:20}...${NC}"
echo -e "   Video URL: ${BLUE}${TEST_VIDEO_URL}${NC}"
echo ""

# Step 1: Create output directory
echo -e "${YELLOW}[1/5] Creating output directory...${NC}"
mkdir -p "$OUTPUT_DIR"
echo -e "${GREEN}✓ Output directory: $OUTPUT_DIR${NC}"
echo ""

# Step 2: Test health endpoint
echo -e "${YELLOW}[2/5] Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s --max-time 30 "$BASE_URL/api/v1/health")
echo "$HEALTH_RESPONSE" | jq '.' > "$OUTPUT_DIR/health.json" 2>/dev/null || echo "$HEALTH_RESPONSE" > "$OUTPUT_DIR/health.json"

# Check if health check was successful
if echo "$HEALTH_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
  STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')
  if [ "$STATUS" = "ok" ] || [ "$STATUS" = "healthy" ] || [ "$STATUS" = "degraded" ]; then
    echo -e "${GREEN}✓ Health check passed (status: ${STATUS})${NC}"
    cat "$OUTPUT_DIR/health.json"
  else
    echo -e "${RED}✗ Health check failed with status: ${STATUS}${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Health endpoint unreachable${NC}"
  echo "$HEALTH_RESPONSE"
  exit 1
fi
echo ""

# Step 3: Test root and OpenAPI docs
echo -e "${YELLOW}[3/5] Testing root and OpenAPI docs...${NC}"
ROOT_RESPONSE=$(curl -s --max-time 30 "$BASE_URL/")
echo "$ROOT_RESPONSE" | jq '.' > "$OUTPUT_DIR/root.json" 2>/dev/null || echo "$ROOT_RESPONSE" > "$OUTPUT_DIR/root.json"

# Check if root has docs link
if echo "$ROOT_RESPONSE" | jq -e '.docs' > /dev/null 2>&1; then
  DOCS_URL=$(echo "$ROOT_RESPONSE" | jq -r '.docs')
  echo -e "${GREEN}✓ Root endpoint OK${NC}"
  echo -e "   Docs: ${BLUE}${BASE_URL}${DOCS_URL}${NC}"
else
  echo -e "${YELLOW}⚠ Root endpoint response unexpected${NC}"
  echo "$ROOT_RESPONSE"
fi

# Test OpenAPI spec
OPENAPI_RESPONSE=$(curl -s --max-time 30 "$BASE_URL/openapi.json")
echo "$OPENAPI_RESPONSE" | jq '.' > "$OUTPUT_DIR/openapi.json" 2>/dev/null || echo "$OPENAPI_RESPONSE" > "$OUTPUT_DIR/openapi.json"

# Verify server URL is NOT localhost
if echo "$OPENAPI_RESPONSE" | jq -e '.servers[0].url' > /dev/null 2>&1; then
  SERVER_URL=$(echo "$OPENAPI_RESPONSE" | jq -r '.servers[0].url')
  if [[ "$SERVER_URL" == *"localhost"* ]]; then
    echo -e "${RED}✗ OpenAPI spec still points to localhost: ${SERVER_URL}${NC}"
    exit 1
  else
    echo -e "${GREEN}✓ OpenAPI spec OK${NC}"
    echo -e "   Server URL: ${BLUE}${SERVER_URL}${NC}"
  fi
else
  echo -e "${YELLOW}⚠ OpenAPI spec response unexpected${NC}"
fi
echo ""

# Step 4: Analyze video
echo -e "${YELLOW}[4/5] Analyzing video...${NC}"
echo -e "   URL: ${BLUE}${TEST_VIDEO_URL}${NC}"
echo ""

ANALYZE_START=$(date +%s)
ANALYZE_RESPONSE=$(curl -s --max-time 30 -X POST "$BASE_URL/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"url\": \"${TEST_VIDEO_URL}\"}")

ANALYZE_END=$(date +%s)
ANALYZE_TIME=$((ANALYZE_END - ANALYZE_START))

echo "$ANALYZE_RESPONSE" | jq '.' > "$OUTPUT_DIR/analyze.json" 2>/dev/null || echo "$ANALYZE_RESPONSE" > "$OUTPUT_DIR/analyze.json"

# Check if analyze was successful
if echo "$ANALYZE_RESPONSE" | jq -e '.metadata' > /dev/null 2>&1; then
  VIDEO_TITLE=$(echo "$ANALYZE_RESPONSE" | jq -r '.metadata.title')
  VIDEO_CHANNEL=$(echo "$ANALYZE_RESPONSE" | jq -r '.metadata.channel')
  VIDEO_DURATION=$(echo "$ANALYZE_RESPONSE" | jq -r '.metadata.duration')
  ESTIMATE_TIME=$(echo "$ANALYZE_RESPONSE" | jq -r '.estimate.processingTime')

  echo -e "${GREEN}✓ Analysis completed in ${ANALYZE_TIME}s${NC}"
  echo -e "   Title: ${BLUE}${VIDEO_TITLE}${NC}"
  echo -e "   Channel: ${BLUE}${VIDEO_CHANNEL}${NC}"
  echo -e "   Duration: ${BLUE}${VIDEO_DURATION}s${NC}"
  echo -e "   Estimated processing: ${BLUE}${ESTIMATE_TIME}s${NC}"

  # Display proxy debug info if available
  if echo "$ANALYZE_RESPONSE" | jq -e '.proxy' > /dev/null 2>&1; then
    PROXY_CONFIGURED=$(echo "$ANALYZE_RESPONSE" | jq -r '.proxy.configured')
    PROXY_VALIDATED=$(echo "$ANALYZE_RESPONSE" | jq -r '.proxy.validated')
    PROXY_FORCED=$(echo "$ANALYZE_RESPONSE" | jq -r '.proxy.forced')
    PROXY_USED=$(echo "$ANALYZE_RESPONSE" | jq -r '.proxy.used')
    PROXY_FALLBACK=$(echo "$ANALYZE_RESPONSE" | jq -r '.proxy.fallbackTriggered')
    echo -e "   ${BLUE}Proxy: configured=${PROXY_CONFIGURED} validated=${PROXY_VALIDATED} forced=${PROXY_FORCED} used=${PROXY_USED} fallbackTriggered=${PROXY_FALLBACK}${NC}"
  fi
else
  echo -e "${RED}✗ Analysis failed${NC}"
  echo "$ANALYZE_RESPONSE"
  exit 1
fi
echo ""

# Step 5: Convert video to PDF (sync)
echo -e "${YELLOW}[5/5] Converting video to PDF (sync mode)...${NC}"
echo -e "   ${YELLOW}This may take 60-120 seconds for a short video...${NC}"
echo ""

CONVERT_START=$(date +%s)
CONVERT_RESPONSE=$(curl -s --max-time 120 -X POST "$BASE_URL/api/v1/jobs/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"url\": \"${TEST_VIDEO_URL}\",
    \"options\": {
      \"format\": \"pdf\",
      \"screenshotInterval\": 30,
      \"layout\": \"horizontal\",
      \"includeTranslation\": false,
      \"includeSummary\": false
    }
  }")

CONVERT_END=$(date +%s)
CONVERT_TIME=$((CONVERT_END - CONVERT_START))

echo "$CONVERT_RESPONSE" | jq '.' > "$OUTPUT_DIR/convert.json" 2>/dev/null || echo "$CONVERT_RESPONSE" > "$OUTPUT_DIR/convert.json"

# Check if conversion was successful
if echo "$CONVERT_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
  STATUS=$(echo "$CONVERT_RESPONSE" | jq -r '.status')

  if [ "$STATUS" = "completed" ]; then
    JOB_ID=$(echo "$CONVERT_RESPONSE" | jq -r '.jobId')
    DOWNLOAD_URL=$(echo "$CONVERT_RESPONSE" | jq -r '.downloadUrl')
    PAGES=$(echo "$CONVERT_RESPONSE" | jq -r '.stats.pages')
    SCREENSHOTS=$(echo "$CONVERT_RESPONSE" | jq -r '.stats.screenshotCount')
    FILE_SIZE=$(echo "$CONVERT_RESPONSE" | jq -r '.stats.fileSize')
    FILE_SIZE_KB=$((FILE_SIZE / 1024))

    echo -e "${GREEN}✓ Conversion completed in ${CONVERT_TIME}s${NC}"
    echo -e "   Job ID: ${BLUE}${JOB_ID}${NC}"
    echo -e "   Pages: ${BLUE}${PAGES}${NC}"
    echo -e "   Screenshots: ${BLUE}${SCREENSHOTS}${NC}"
    echo -e "   File size: ${BLUE}${FILE_SIZE_KB} KB${NC}"

    # Display proxy debug info if available
    if echo "$CONVERT_RESPONSE" | jq -e '.proxy' > /dev/null 2>&1; then
      PROXY_CONFIGURED=$(echo "$CONVERT_RESPONSE" | jq -r '.proxy.configured')
      PROXY_VALIDATED=$(echo "$CONVERT_RESPONSE" | jq -r '.proxy.validated')
      PROXY_FORCED=$(echo "$CONVERT_RESPONSE" | jq -r '.proxy.forced')
      PROXY_USED=$(echo "$CONVERT_RESPONSE" | jq -r '.proxy.used')
      PROXY_FALLBACK=$(echo "$CONVERT_RESPONSE" | jq -r '.proxy.fallbackTriggered')
      echo -e "   ${BLUE}Proxy: configured=${PROXY_CONFIGURED} validated=${PROXY_VALIDATED} forced=${PROXY_FORCED} used=${PROXY_USED} fallbackTriggered=${PROXY_FALLBACK}${NC}"
    fi
    echo ""

    # Display download URL (GCS or file://)
    if [[ "$DOWNLOAD_URL" == https://storage.googleapis.com/* ]]; then
      echo -e "   ${GREEN}Download URL: ${BLUE}${DOWNLOAD_URL}${NC}"
      echo -e "   ${YELLOW}(GCS signed URL - download manually or use curl/wget)${NC}"
    elif [[ "$DOWNLOAD_URL" == file://* ]]; then
      echo -e "   ${YELLOW}Download URL: ${DOWNLOAD_URL}${NC}"
      echo -e "   ${YELLOW}(Local file path on remote server - cannot download)${NC}"
    else
      echo -e "   ${YELLOW}Download URL: ${DOWNLOAD_URL}${NC}"
    fi
  else
    echo -e "${RED}✗ Conversion failed with status: ${STATUS}${NC}"
    ERROR=$(echo "$CONVERT_RESPONSE" | jq -r '.error // "Unknown error"')
    echo -e "   Error: ${RED}${ERROR}${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Conversion request failed${NC}"
  echo "$CONVERT_RESPONSE"
  exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All tests completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Results saved to: ${BLUE}${OUTPUT_DIR}/${NC}"
echo -e "  - health.json"
echo -e "  - root.json"
echo -e "  - openapi.json"
echo -e "  - analyze.json"
echo -e "  - convert.json"
echo ""
echo -e "${YELLOW}Tip: 다른 비디오로 테스트하려면:${NC}"
echo -e "  ./scripts/test-api-prod.sh \"${BASE_URL}\" \"https://www.youtube.com/watch?v=YOUR_VIDEO_ID\""
echo ""
echo -e "${YELLOW}Tip: 다른 API 키로 테스트하려면:${NC}"
echo -e "  V2DOC_API_KEY=your_key ./scripts/test-api-prod.sh"
echo ""
