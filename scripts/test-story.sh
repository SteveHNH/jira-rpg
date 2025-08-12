#!/bin/bash

# test-story.sh - Test story generation and AI endpoints
# Usage: ./scripts/test-story.sh [test] [--pretty]
#   test: health, story, guild, full, or list
#   --pretty: format JSON output with jq

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_TYPE="${1:-list}"
PRETTY="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${PURPLE}🧙‍♂️ JIRA RPG Story Generator Tester${NC}"
    echo "======================================="
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

print_test_header() {
    echo -e "${BLUE}🧪 $1${NC}"
}

format_output() {
    if [[ "$PRETTY" == "--pretty" ]] && command -v jq >/dev/null 2>&1; then
        jq '.'
    else
        cat
    fi
}

test_endpoint() {
    local url="$1"
    local description="$2"
    
    print_test_header "Testing: $description"
    echo "URL: $url"
    echo ""
    
    local response
    local exit_code
    
    if response=$(curl -s "$url" 2>&1); then
        echo "$response" | format_output
        print_success "Request successful"
        exit_code=0
    else
        print_error "Request failed: $response"
        exit_code=1
    fi
    
    echo ""
    return $exit_code
}

check_ollama_health() {
    print_test_header "Checking Ollama API Health"
    
    local response
    if response=$(curl -s "$BASE_URL/api/other-test?test=health" 2>&1); then
        echo "$response" | format_output
        
        # Parse response to check if healthy
        if echo "$response" | grep -q '"healthy":true'; then
            print_success "Ollama API is healthy"
            return 0
        else
            print_error "Ollama API is not healthy"
            return 1
        fi
    else
        print_error "Failed to connect to health check endpoint"
        return 1
    fi
}

print_header

case "$TEST_TYPE" in
    "list"|"")
        print_info "Listing available story generation tests"
        test_endpoint "$BASE_URL/api/other-test" "Available test options"
        ;;
        
    "health")
        print_info "Testing Ollama API health"
        if check_ollama_health; then
            print_success "Health check passed - Ollama is ready!"
        else
            print_error "Health check failed - check Ollama configuration"
            exit 1
        fi
        ;;
        
    "story")
        print_info "Testing AI story generation"
        if check_ollama_health; then
            print_info "Health check passed, proceeding with story generation..."
            test_endpoint "$BASE_URL/api/other-test?test=story" "AI story generation with sample data"
        else
            print_error "Health check failed - skipping story generation test"
            exit 1
        fi
        ;;
        
    "guild")
        print_info "Testing guild extraction from JIRA data"
        test_endpoint "$BASE_URL/api/other-test?test=guild" "Guild information extraction"
        ;;
        
    "full")
        print_info "Running full story generation test suite"
        echo ""
        
        local all_passed=true
        
        print_test_header "1. Health Check"
        if ! check_ollama_health; then
            all_passed=false
        fi
        echo ""
        
        print_test_header "2. Guild Extraction Test"
        if ! test_endpoint "$BASE_URL/api/other-test?test=guild" "Guild extraction"; then
            all_passed=false
        fi
        
        print_test_header "3. Story Generation Test"
        if ! test_endpoint "$BASE_URL/api/other-test?test=story" "AI story generation"; then
            all_passed=false
        fi
        
        print_test_header "4. Full Integration Test"
        if ! test_endpoint "$BASE_URL/api/other-test?test=full" "Complete test suite"; then
            all_passed=false
        fi
        
        if $all_passed; then
            print_success "🎉 All story generation tests passed!"
        else
            print_error "❌ Some tests failed - check configuration"
            exit 1
        fi
        ;;
        
    "benchmark")
        print_info "Running story generation benchmark"
        echo ""
        
        print_test_header "Generating 5 stories to test performance..."
        
        local total_time=0
        local successful_requests=0
        
        for i in {1..5}; do
            print_info "Request $i/5"
            
            local start_time=$(date +%s.%N)
            
            if curl -s "$BASE_URL/api/other-test?test=story" > /dev/null 2>&1; then
                local end_time=$(date +%s.%N)
                local request_time=$(echo "$end_time - $start_time" | bc -l)
                printf "Response time: %.2f seconds\n" "$request_time"
                
                total_time=$(echo "$total_time + $request_time" | bc -l)
                ((successful_requests++))
            else
                print_error "Request $i failed"
            fi
            
            # Small delay between requests
            sleep 0.5
        done
        
        if [ $successful_requests -gt 0 ]; then
            local avg_time=$(echo "scale=2; $total_time / $successful_requests" | bc -l)
            echo ""
            print_success "Benchmark Results:"
            echo "Successful requests: $successful_requests/5"
            printf "Average response time: %.2f seconds\n" "$avg_time"
        else
            print_error "All benchmark requests failed"
            exit 1
        fi
        ;;
        
    *)
        print_error "Unknown test type: $TEST_TYPE"
        echo ""
        echo "Available test types:"
        echo "  list      - Show available test options"
        echo "  health    - Check Ollama API health"
        echo "  story     - Test AI story generation"
        echo "  guild     - Test guild extraction"
        echo "  full      - Run complete test suite"
        echo "  benchmark - Performance test (5 requests)"
        echo ""
        echo "Usage: $0 [test] [--pretty]"
        echo "Example: $0 story --pretty"
        exit 1
        ;;
esac