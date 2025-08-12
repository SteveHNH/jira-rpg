#!/bin/bash

# health-check.sh - Comprehensive health check for JIRA RPG system
# Usage: ./scripts/health-check.sh [--pretty] [--verbose]

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
PRETTY=""
VERBOSE=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --pretty)
            PRETTY="--pretty"
            shift
            ;;
        --verbose)
            VERBOSE="--verbose"
            shift
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}🏥 JIRA RPG System Health Check${NC}"
    echo "=================================="
    echo "Base URL: $BASE_URL"
    echo "Timestamp: $(date)"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_section() {
    echo -e "${PURPLE}📋 $1${NC}"
    echo "$(printf '%.0s-' {1..40})"
}

check_endpoint() {
    local url="$1"
    local description="$2"
    local expected_status="${3:-200}"
    
    if [[ "$VERBOSE" == "--verbose" ]]; then
        print_info "Checking: $description"
        echo "URL: $url"
    fi
    
    local response
    local http_code
    
    if response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null); then
        http_code="${response: -3}"
        response_body="${response%???}"
        
        if [[ "$http_code" == "$expected_status" ]]; then
            print_success "$description (HTTP $http_code)"
            if [[ "$VERBOSE" == "--verbose" && -n "$response_body" ]]; then
                echo "Response: $response_body" | head -c 200
                echo "..."
            fi
            return 0
        else
            print_error "$description (HTTP $http_code, expected $expected_status)"
            return 1
        fi
    else
        print_error "$description (Connection failed)"
        return 1
    fi
}

check_json_endpoint() {
    local url="$1"
    local description="$2"
    local key_to_check="$3"
    
    if [[ "$VERBOSE" == "--verbose" ]]; then
        print_info "Checking JSON endpoint: $description"
    fi
    
    local response
    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | jq . >/dev/null 2>&1; then
            if [[ -n "$key_to_check" ]]; then
                if echo "$response" | jq -e "$key_to_check" >/dev/null 2>&1; then
                    print_success "$description (Valid JSON with $key_to_check)"
                    return 0
                else
                    print_warning "$description (Valid JSON but missing $key_to_check)"
                    return 1
                fi
            else
                print_success "$description (Valid JSON)"
                return 0
            fi
        else
            print_error "$description (Invalid JSON response)"
            return 1
        fi
    else
        print_error "$description (Connection failed)"
        return 1
    fi
}

# Main health check
print_header

# Track overall health
overall_health=true

# 1. Basic Endpoint Connectivity
print_section "Basic Endpoint Connectivity"

if ! check_endpoint "$BASE_URL/api/test" "Webhook test endpoint"; then
    overall_health=false
fi

if ! check_endpoint "$BASE_URL/api/other-test" "Story generation test endpoint"; then
    overall_health=false
fi

echo ""

# 2. API Response Validation
print_section "API Response Validation"

if ! check_json_endpoint "$BASE_URL/api/test" "Webhook test JSON response" ".availableScenarios"; then
    overall_health=false
fi

if ! check_json_endpoint "$BASE_URL/api/other-test" "Story test JSON response" ".availableTests"; then
    overall_health=false
fi

echo ""

# 3. Ollama AI Health
print_section "AI Service Health"

if check_json_endpoint "$BASE_URL/api/other-test?test=health" "Ollama API health check" ".result.healthy"; then
    print_info "Checking Ollama model availability..."
    if curl -s "$BASE_URL/api/other-test?test=health" | jq -e '.result.hasJiraModel == true' >/dev/null 2>&1; then
        print_success "jira-storyteller model is available"
    else
        print_warning "jira-storyteller model may not be available"
        overall_health=false
    fi
else
    print_error "Ollama API is not healthy"
    overall_health=false
fi

echo ""

# 4. Database Connectivity (through webhook test)
print_section "Database Connectivity"

if curl -s -X POST "$BASE_URL/api/test?scenario=inProgress" | jq -e '.success == true' >/dev/null 2>&1; then
    print_success "Firebase database connectivity (via webhook test)"
else
    print_error "Firebase database connectivity failed"
    overall_health=false
fi

echo ""

# 5. Environment Configuration Check
print_section "Environment Configuration"

# We can't directly check env vars, but we can infer from API responses
if curl -s "$BASE_URL/api/other-test?test=health" | jq -e '.result.healthy' >/dev/null 2>&1; then
    print_success "Ollama configuration appears valid"
else
    print_warning "Ollama configuration may be missing or invalid"
fi

# Check if Firebase is configured by testing user creation
if curl -s -X POST "$BASE_URL/api/test?scenario=inProgress" | jq -e '.processingDetails.userAffected' >/dev/null 2>&1; then
    print_success "Firebase configuration appears valid"
else
    print_warning "Firebase configuration may be missing or invalid"
fi

echo ""

# 6. Performance Check
print_section "Performance Check"

print_info "Testing response times..."

start_time=$(date +%s.%N)
if curl -s "$BASE_URL/api/test" >/dev/null 2>&1; then
    end_time=$(date +%s.%N)
    response_time=$(echo "$end_time - $start_time" | bc -l)
    if (( $(echo "$response_time < 5.0" | bc -l) )); then
        printf "✅ Webhook endpoint response time: %.2f seconds\n" "$response_time"
    else
        printf "⚠️  Webhook endpoint slow response: %.2f seconds\n" "$response_time"
        overall_health=false
    fi
else
    print_error "Webhook endpoint performance test failed"
    overall_health=false
fi

echo ""

# Final Health Summary
print_section "Overall System Health"

if $overall_health; then
    print_success "🎉 All systems are healthy and operational!"
    echo ""
    print_info "System is ready for:"
    echo "  • JIRA webhook processing"
    echo "  • AI story generation"
    echo "  • User XP tracking"
    echo "  • Development testing"
    exit 0
else
    print_error "⚠️  Some systems need attention"
    echo ""
    print_info "Common fixes:"
    echo "  • Check environment variables in .env.local"
    echo "  • Verify Ollama API is running and accessible"
    echo "  • Confirm Firebase project configuration"
    echo "  • Ensure vercel dev is running on correct port"
    exit 1
fi