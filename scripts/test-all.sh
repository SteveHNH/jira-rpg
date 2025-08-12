#!/bin/bash

# test-all.sh - Comprehensive test runner for JIRA RPG system
# Usage: ./scripts/test-all.sh [--fast] [--pretty] [--verbose]

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAST_MODE=""
PRETTY=""
VERBOSE=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --fast)
            FAST_MODE="--fast"
            shift
            ;;
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
BOLD='\033[1m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BOLD}${CYAN}"
    echo "████████████████████████████████████████"
    echo "█                                      █"
    echo "█        🗡️  JIRA RPG TEST SUITE  ⚔️      █"
    echo "█                                      █"
    echo "████████████████████████████████████████"
    echo -e "${NC}"
    echo "Running comprehensive test suite..."
    echo "Base URL: $BASE_URL"
    echo "Timestamp: $(date)"
    echo ""
}

print_section() {
    echo -e "${BOLD}${PURPLE}━━━ $1 ━━━${NC}"
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

print_step() {
    echo -e "${CYAN}🔄 $1${NC}"
}

run_script() {
    local script="$1"
    local description="$2"
    local args="$3"
    
    print_step "Running: $description"
    
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo "Command: ./scripts/$script $args"
    fi
    
    if ./scripts/"$script" $args; then
        print_success "$description completed successfully"
        return 0
    else
        print_error "$description failed"
        return 1
    fi
}

wait_for_server() {
    print_info "Checking if development server is running..."
    
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$BASE_URL/api/test" >/dev/null 2>&1; then
            print_success "Development server is running"
            return 0
        else
            print_warning "Attempt $attempt/$max_attempts: Server not responding"
            if [ $attempt -lt $max_attempts ]; then
                echo "Waiting 3 seconds before retry..."
                sleep 3
            fi
            ((attempt++))
        fi
    done
    
    print_error "Development server is not responding after $max_attempts attempts"
    echo ""
    print_info "Please ensure 'vercel dev' is running:"
    echo "  cd $(pwd)"
    echo "  vercel dev"
    echo ""
    return 1
}

# Main test execution
print_banner

# Track test results
tests_passed=0
tests_failed=0
test_results=()

# Check if server is running
if ! wait_for_server; then
    print_error "Cannot proceed without development server"
    exit 1
fi

echo ""

# 1. Health Check
print_section "System Health Check"
if run_script "health-check.sh" "System health validation" "$VERBOSE"; then
    ((tests_passed++))
    test_results+=("✅ Health Check")
else
    ((tests_failed++))
    test_results+=("❌ Health Check")
    if [[ "$FAST_MODE" != "--fast" ]]; then
        print_warning "Health check failed, but continuing with tests..."
    else
        print_error "Health check failed, stopping in fast mode"
        exit 1
    fi
fi

echo ""

# 2. Webhook Tests
print_section "Webhook Processing Tests"
if run_script "test-webhook.sh" "Webhook functionality" "all $PRETTY"; then
    ((tests_passed++))
    test_results+=("✅ Webhook Tests")
else
    ((tests_failed++))
    test_results+=("❌ Webhook Tests")
fi

echo ""

# 3. Story Generation Tests
print_section "Story Generation Tests"
if [[ "$FAST_MODE" == "--fast" ]]; then
    # In fast mode, just run health check for story generation
    if run_script "test-story.sh" "Story generation (fast)" "health $PRETTY"; then
        ((tests_passed++))
        test_results+=("✅ Story Tests (Fast)")
    else
        ((tests_failed++))
        test_results+=("❌ Story Tests (Fast)")
    fi
else
    # Full story generation test suite
    if run_script "test-story.sh" "Story generation" "full $PRETTY"; then
        ((tests_passed++))
        test_results+=("✅ Story Tests (Full)")
    else
        ((tests_failed++))
        test_results+=("❌ Story Tests (Full)")
    fi
fi

echo ""

# 4. Integration Tests (if not in fast mode)
if [[ "$FAST_MODE" != "--fast" ]]; then
    print_section "Integration Tests"
    
    print_step "Testing end-to-end webhook to story flow..."
    
    # Test webhook that should trigger story generation
    if curl -s -X POST "$BASE_URL/api/test?scenario=done" | jq -e '.success == true' >/dev/null 2>&1; then
        print_success "Webhook processing integration"
        
        # Test story generation with the same data
        if curl -s "$BASE_URL/api/other-test?test=story" >/dev/null 2>&1; then
            print_success "Story generation integration"
            ((tests_passed++))
            test_results+=("✅ Integration Tests")
        else
            print_error "Story generation integration failed"
            ((tests_failed++))
            test_results+=("❌ Integration Tests")
        fi
    else
        print_error "Webhook processing integration failed"
        ((tests_failed++))
        test_results+=("❌ Integration Tests")
    fi
    
    echo ""
fi

# 5. Performance Tests (if not in fast mode)
if [[ "$FAST_MODE" != "--fast" ]]; then
    print_section "Performance Tests"
    
    print_step "Running story generation benchmark..."
    if run_script "test-story.sh" "Performance benchmark" "benchmark"; then
        ((tests_passed++))
        test_results+=("✅ Performance Tests")
    else
        ((tests_failed++))
        test_results+=("❌ Performance Tests")
    fi
    
    echo ""
fi

# Test Results Summary
print_section "Test Results Summary"

echo ""
echo -e "${BOLD}Test Results:${NC}"
for result in "${test_results[@]}"; do
    echo "  $result"
done

echo ""
echo -e "${BOLD}Statistics:${NC}"
echo "  Tests Passed: $tests_passed"
echo "  Tests Failed: $tests_failed"
echo "  Total Tests: $((tests_passed + tests_failed))"

if [ $tests_failed -eq 0 ]; then
    echo ""
    print_success "🎉 ALL TESTS PASSED! Your JIRA RPG system is ready for action!"
    echo ""
    print_info "Next steps:"
    echo "  • Set up JIRA webhook pointing to your deployed app"
    echo "  • Configure Slack bot integration"  
    echo "  • Start tracking your development adventures!"
    echo ""
    exit 0
else
    echo ""
    print_error "❌ Some tests failed. Please review the output above."
    echo ""
    print_info "Common solutions:"
    echo "  • Check .env.local configuration"
    echo "  • Verify all services (Ollama, Firebase) are accessible"
    echo "  • Run individual test scripts for detailed debugging"
    echo "  • Check the logs with 'vercel logs --follow'"
    echo ""
    exit 1
fi