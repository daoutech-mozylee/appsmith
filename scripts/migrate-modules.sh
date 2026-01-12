#!/bin/bash
#
# Module Migration Script
#
# 기존 data/packages/*.json 파일들을 중계서버 API로 업로드합니다.
#
# Usage:
#   ./scripts/migrate-modules.sh [options]
#
# Options:
#   -u, --url URL       중계서버 URL (기본값: http://localhost:8090)
#   -d, --dry-run       실제 업로드 없이 파일 목록만 출력
#   -v, --verbose       상세 로그 출력
#   -h, --help          도움말 출력
#
# Environment Variables:
#   RELAY_URL           중계서버 URL (옵션보다 우선순위 낮음)
#
# Examples:
#   ./scripts/migrate-modules.sh
#   ./scripts/migrate-modules.sh --url http://relay.example.com:8090
#   ./scripts/migrate-modules.sh --dry-run
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RELAY_URL="${RELAY_URL:-http://localhost:8090}"
DRY_RUN=false
VERBOSE=false
PACKAGES_DIR="app/client/src/data/packages"

# Counters
TOTAL=0
SUCCESS=0
FAILED=0
SKIPPED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            RELAY_URL="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            head -30 "$0" | tail -28
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if packages directory exists
if [ ! -d "$PACKAGES_DIR" ]; then
    echo -e "${RED}Error: Packages directory not found: $PACKAGES_DIR${NC}"
    echo "Please run this script from the repository root directory."
    exit 1
fi

# Count JSON files
JSON_FILES=("$PACKAGES_DIR"/*.json)
if [ ! -f "${JSON_FILES[0]}" ]; then
    echo -e "${YELLOW}No JSON files found in $PACKAGES_DIR${NC}"
    exit 0
fi

TOTAL=${#JSON_FILES[@]}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Module Migration Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Relay URL: ${GREEN}$RELAY_URL${NC}"
echo -e "Packages Dir: ${GREEN}$PACKAGES_DIR${NC}"
echo -e "Total Files: ${GREEN}$TOTAL${NC}"
echo -e "Dry Run: ${YELLOW}$DRY_RUN${NC}"
echo ""

# Check relay server connectivity (skip in dry-run mode)
if [ "$DRY_RUN" = false ]; then
    echo -e "${BLUE}Checking relay server connectivity...${NC}"

    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$RELAY_URL/relay/actuator/health" 2>/dev/null || echo "000")

    if [ "$HEALTH_CHECK" != "200" ]; then
        echo -e "${YELLOW}Warning: Could not reach relay server health endpoint (status: $HEALTH_CHECK)${NC}"
        echo -e "${YELLOW}Continuing anyway...${NC}"
    else
        echo -e "${GREEN}Relay server is healthy.${NC}"
    fi
    echo ""
fi

echo -e "${BLUE}Starting migration...${NC}"
echo ""

# Process each JSON file
for file in "${JSON_FILES[@]}"; do
    filename=$(basename "$file")
    TOTAL=$((TOTAL))

    echo -e "${BLUE}[$((SUCCESS + FAILED + SKIPPED + 1))/$TOTAL]${NC} Processing: $filename"

    # Dry run mode - just list files
    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN]${NC} Would upload: $file"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Extract module name from JSON for logging
    MODULE_NAME=$(jq -r '.exportedPackage.name // .moduleName // "unknown"' "$file" 2>/dev/null || echo "unknown")

    if [ "$VERBOSE" = true ]; then
        echo -e "  Module Name: $MODULE_NAME"
    fi

    # Upload file to relay server
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "$RELAY_URL/relay/api/modules/upload" \
        -F "file=@$file" \
        -F "changeLog=Initial migration from JSON files" \
        2>&1)

    # Extract HTTP status code (last line)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    # Extract response body (all lines except last)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        # Success
        SUCCESS=$((SUCCESS + 1))

        # Extract moduleUUID from response
        MODULE_UUID=$(echo "$BODY" | jq -r '.moduleInfo.moduleUUID // "N/A"' 2>/dev/null || echo "N/A")
        VERSION=$(echo "$BODY" | jq -r '.moduleInfo.version // "N/A"' 2>/dev/null || echo "N/A")

        echo -e "  ${GREEN}[SUCCESS]${NC} Uploaded successfully (UUID: $MODULE_UUID, Version: $VERSION)"
    else
        # Failed
        FAILED=$((FAILED + 1))

        # Extract error message from response
        ERROR_MSG=$(echo "$BODY" | jq -r '.message // .error // "Unknown error"' 2>/dev/null || echo "$BODY")

        echo -e "  ${RED}[FAILED]${NC} HTTP $HTTP_CODE - $ERROR_MSG"

        if [ "$VERBOSE" = true ]; then
            echo -e "  Response: $BODY"
        fi
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Migration Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Files:    ${GREEN}$TOTAL${NC}"
echo -e "Successful:     ${GREEN}$SUCCESS${NC}"
echo -e "Failed:         ${RED}$FAILED${NC}"
echo -e "Skipped:        ${YELLOW}$SKIPPED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Migration completed with errors.${NC}"
    exit 1
elif [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry run completed. No files were uploaded.${NC}"
    exit 0
else
    echo -e "${GREEN}Migration completed successfully!${NC}"
    exit 0
fi
