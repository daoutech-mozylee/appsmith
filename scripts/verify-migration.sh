#!/bin/bash
#
# Module Migration Verification Script
#
# 마이그레이션 후 모든 모듈이 API에서 정상적으로 조회되는지 검증합니다.
#
# Usage:
#   ./scripts/verify-migration.sh [options]
#
# Options:
#   -s, --server URL    Appsmith 서버 URL (기본값: http://localhost:8080)
#   -r, --relay URL     중계서버 URL (기본값: http://localhost:8090)
#   -v, --verbose       상세 로그 출력
#   -h, --help          도움말 출력
#
# Environment Variables:
#   APPSMITH_SERVER_URL   Appsmith 서버 URL
#   RELAY_URL             중계서버 URL
#
# Examples:
#   ./scripts/verify-migration.sh
#   ./scripts/verify-migration.sh --server http://appsmith.example.com:8080
#   ./scripts/verify-migration.sh --verbose
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
APPSMITH_SERVER_URL="${APPSMITH_SERVER_URL:-http://localhost:8080}"
RELAY_URL="${RELAY_URL:-http://localhost:8090}"
VERBOSE=false
PACKAGES_DIR="app/client/src/data/packages"

# Counters
TOTAL_JSON=0
TOTAL_API=0
VERIFIED=0
MISSING=0
ERRORS=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--server)
            APPSMITH_SERVER_URL="$2"
            shift 2
            ;;
        -r|--relay)
            RELAY_URL="$2"
            shift 2
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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Module Migration Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Appsmith Server: ${GREEN}$APPSMITH_SERVER_URL${NC}"
echo -e "Relay Server: ${GREEN}$RELAY_URL${NC}"
echo -e "Packages Dir: ${GREEN}$PACKAGES_DIR${NC}"
echo ""

# Check if packages directory exists
if [ ! -d "$PACKAGES_DIR" ]; then
    echo -e "${RED}Error: Packages directory not found: $PACKAGES_DIR${NC}"
    echo "Please run this script from the repository root directory."
    exit 1
fi

# Count local JSON files
JSON_FILES=("$PACKAGES_DIR"/*.json)
if [ -f "${JSON_FILES[0]}" ]; then
    TOTAL_JSON=${#JSON_FILES[@]}
fi

echo -e "${BLUE}Step 1: Counting local JSON files...${NC}"
echo -e "Local JSON files: ${GREEN}$TOTAL_JSON${NC}"
echo ""

# Fetch modules from Appsmith API
echo -e "${BLUE}Step 2: Fetching modules from Appsmith API...${NC}"

API_RESPONSE=$(curl -s "$APPSMITH_SERVER_URL/all-apps/api/v1/modules" 2>/dev/null || echo '{"error": "Connection failed"}')

# Check if response is valid JSON
if ! echo "$API_RESPONSE" | jq empty 2>/dev/null; then
    echo -e "${RED}Error: Invalid response from Appsmith API${NC}"
    echo -e "Response: $API_RESPONSE"
    exit 1
fi

# Check if error in response
if echo "$API_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$API_RESPONSE" | jq -r '.error // .message // "Unknown error"')
    echo -e "${RED}Error: $ERROR_MSG${NC}"
    exit 1
fi

# Extract module list from response
API_MODULES=$(echo "$API_RESPONSE" | jq -r '.data // []')
TOTAL_API=$(echo "$API_MODULES" | jq 'length')

echo -e "API modules count: ${GREEN}$TOTAL_API${NC}"
echo ""

# Compare counts
echo -e "${BLUE}Step 3: Comparing module counts...${NC}"

if [ "$TOTAL_JSON" -eq "$TOTAL_API" ]; then
    echo -e "${GREEN}Module counts match: $TOTAL_JSON local = $TOTAL_API API${NC}"
else
    echo -e "${YELLOW}Module counts differ: $TOTAL_JSON local vs $TOTAL_API API${NC}"
fi
echo ""

# Verify each local module exists in API
echo -e "${BLUE}Step 4: Verifying each module...${NC}"
echo ""

for file in "${JSON_FILES[@]}"; do
    filename=$(basename "$file")

    # Extract moduleUUID from local JSON
    LOCAL_UUID=$(jq -r '.exportedPackage.modules[0].moduleUUID // .moduleUUID // empty' "$file" 2>/dev/null)
    LOCAL_NAME=$(jq -r '.exportedPackage.name // .moduleName // "unknown"' "$file" 2>/dev/null)

    if [ -z "$LOCAL_UUID" ]; then
        echo -e "${YELLOW}[SKIP]${NC} $filename - No moduleUUID found in JSON"
        MISSING=$((MISSING + 1))
        continue
    fi

    echo -e "${BLUE}Verifying:${NC} $LOCAL_NAME ($LOCAL_UUID)"

    # Check if module exists in API response
    API_MODULE=$(echo "$API_MODULES" | jq --arg uuid "$LOCAL_UUID" '.[] | select(.moduleUUID == $uuid)' 2>/dev/null)

    if [ -n "$API_MODULE" ] && [ "$API_MODULE" != "null" ]; then
        # Module found - verify details
        API_NAME=$(echo "$API_MODULE" | jq -r '.moduleName // "N/A"')
        API_VERSION=$(echo "$API_MODULE" | jq -r '.version // "N/A"')

        echo -e "  ${GREEN}[FOUND]${NC} Name: $API_NAME, Version: $API_VERSION"

        # Fetch module detail to verify definition
        if [ "$VERBOSE" = true ]; then
            DETAIL_RESPONSE=$(curl -s "$APPSMITH_SERVER_URL/all-apps/api/v1/modules/$LOCAL_UUID" 2>/dev/null)
            HAS_DEFINITION=$(echo "$DETAIL_RESPONSE" | jq -e '.data.definition' > /dev/null 2>&1 && echo "yes" || echo "no")

            if [ "$HAS_DEFINITION" = "yes" ]; then
                echo -e "  ${GREEN}[DETAIL]${NC} Definition exists"
            else
                echo -e "  ${YELLOW}[DETAIL]${NC} Definition missing or empty"
            fi
        fi

        VERIFIED=$((VERIFIED + 1))
    else
        echo -e "  ${RED}[MISSING]${NC} Module not found in API"
        MISSING=$((MISSING + 1))

        if [ "$VERBOSE" = true ]; then
            echo -e "  Expected UUID: $LOCAL_UUID"
        fi
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Local JSON Files:    ${GREEN}$TOTAL_JSON${NC}"
echo -e "API Modules:         ${GREEN}$TOTAL_API${NC}"
echo -e "Verified:            ${GREEN}$VERIFIED${NC}"
echo -e "Missing in API:      ${RED}$MISSING${NC}"
echo -e "Errors:              ${RED}$ERRORS${NC}"
echo ""

# Test relay server proxy (optional)
echo -e "${BLUE}Step 5: Testing relay server proxy...${NC}"

RELAY_RESPONSE=$(curl -s "$RELAY_URL/relay/api/modules" 2>/dev/null || echo '{"error": "Connection failed"}')
RELAY_COUNT=$(echo "$RELAY_RESPONSE" | jq 'length' 2>/dev/null || echo "0")

if [ "$RELAY_COUNT" != "0" ] && [ "$RELAY_COUNT" != "null" ]; then
    echo -e "${GREEN}Relay server proxy working: $RELAY_COUNT modules${NC}"
else
    echo -e "${YELLOW}Relay server proxy returned empty or error${NC}"
    if [ "$VERBOSE" = true ]; then
        echo -e "Response: $RELAY_RESPONSE"
    fi
fi
echo ""

# Final result
if [ $MISSING -eq 0 ] && [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All modules verified successfully!${NC}"
    exit 0
elif [ $MISSING -gt 0 ]; then
    echo -e "${YELLOW}Some modules are missing in API. Please run migration script.${NC}"
    exit 1
else
    echo -e "${RED}Verification completed with errors.${NC}"
    exit 1
fi
