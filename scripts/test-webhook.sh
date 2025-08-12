#!/bin/bash

# test-webhook.sh - Test JIRA webhook endpoints
# Usage: ./scripts/test-webhook.sh [scenario] [--pretty]
#   scenario: inProgress, done, or custom
#   --pretty: format JSON output with jq

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCENARIO="${1:-list}"
PRETTY="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}🗡️  JIRA RPG Webhook Tester${NC}"
    echo "=================================="
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

format_output() {
    if [[ "$PRETTY" == "--pretty" ]] && command -v jq >/dev/null 2>&1; then
        jq '.'
    else
        cat
    fi
}

test_endpoint() {
    local method="$1"
    local url="$2"
    local data="$3"
    local description="$4"
    
    print_info "Testing: $description"
    echo "URL: $url"
    
    if [[ "$method" == "GET" ]]; then
        if curl -s "$url" | format_output; then
            print_success "GET request successful"
        else
            print_error "GET request failed"
            return 1
        fi
    else
        if [[ -n "$data" ]]; then
            if curl -s -X POST "$url" -H "Content-Type: application/json" -d "$data" | format_output; then
                print_success "POST request successful"
            else
                print_error "POST request failed"
                return 1
            fi
        else
            if curl -s -X POST "$url" | format_output; then
                print_success "POST request successful"
            else
                print_error "POST request failed"
                return 1
            fi
        fi
    fi
    echo ""
}

print_header

case "$SCENARIO" in
    "list"|"")
        print_info "Listing available test scenarios"
        test_endpoint "GET" "$BASE_URL/api/test" "" "Available webhook scenarios"
        ;;
        
    "inProgress"|"in-progress")
        print_info "Testing 'In Progress' webhook scenario"
        test_endpoint "POST" "$BASE_URL/api/test?scenario=inProgress" "" "JIRA ticket moved to In Progress"
        ;;
        
    "done")
        print_info "Testing 'Done' webhook scenario"
        test_endpoint "POST" "$BASE_URL/api/test?scenario=done" "" "JIRA ticket completed"
        ;;
        
    "custom")
        print_info "Testing with custom payload"
        CUSTOM_PAYLOAD='{
            "webhookEvent": "jira:issue_updated",
            "issue": {
                "key": "CUSTOM-001",
                "fields": {
                    "summary": "Custom test issue",
                    "status": {"name": "Done"},
                    "assignee": {
                        "name": "test.user",
                        "emailAddress": "test.user@company.com",
                        "displayName": "Test User"
                    }
                }
            },
            "user": {
                "name": "test.user",
                "emailAddress": "test.user@company.com",
                "displayName": "Test User"
            }
        }'
        test_endpoint "POST" "$BASE_URL/api/test" "$CUSTOM_PAYLOAD" "Custom webhook payload"
        ;;
        
    "all")
        print_info "Running all webhook tests"
        echo ""
        
        print_info "1. Listing available scenarios"
        test_endpoint "GET" "$BASE_URL/api/test" "" "Available scenarios"
        
        print_info "2. Testing 'In Progress' scenario"
        test_endpoint "POST" "$BASE_URL/api/test?scenario=inProgress" "" "In Progress webhook"
        
        print_info "3. Testing 'Done' scenario"
        test_endpoint "POST" "$BASE_URL/api/test?scenario=done" "" "Done webhook"
        
        print_success "All webhook tests completed!"
        ;;
        
    *)
        print_error "Unknown scenario: $SCENARIO"
        echo ""
        echo "Available scenarios:"
        echo "  list        - Show available test scenarios"
        echo "  inProgress  - Test 'In Progress' webhook"
        echo "  done        - Test 'Done' webhook"
        echo "  custom      - Test with custom payload"
        echo "  all         - Run all tests"
        echo ""
        echo "Usage: $0 [scenario] [--pretty]"
        echo "Example: $0 inProgress --pretty"
        exit 1
        ;;
esac