#!/bin/bash

# Integration test script for Slack functionality
# Tests the complete flow from Slack commands through to responses
# Usage: ./scripts/test-slack-integration.sh [local|staging|production]

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-"local"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Environment-specific configurations
case $ENVIRONMENT in
    "local")
        BASE_URL="http://localhost:3000"
        echo "🧪 Running integration tests against LOCAL environment"
        ;;
    "staging")
        BASE_URL="https://your-vercel-staging-url.vercel.app"
        echo "🧪 Running integration tests against STAGING environment"
        ;;
    "production")
        BASE_URL="https://your-vercel-production-url.vercel.app"
        echo "🧪 Running integration tests against PRODUCTION environment"
        echo "⚠️  WARNING: Testing against production! Proceed with caution."
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Cancelled by user"
            exit 1
        fi
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        echo "Usage: $0 [local|staging|production]"
        exit 1
        ;;
esac

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    # Check if jq is available (for JSON parsing)
    if ! command -v jq &> /dev/null; then
        log_warning "jq not installed - JSON output will be less readable"
        JQ_AVAILABLE=false
    else
        JQ_AVAILABLE=true
    fi
    
    # Check environment variables
    if [[ -z "$SLACK_SIGNING_SECRET" ]]; then
        log_warning "SLACK_SIGNING_SECRET not set - using test value"
        export SLACK_SIGNING_SECRET="test-signing-secret-for-development"
    fi
    
    log_success "Prerequisites check completed"
}

# Test endpoint availability
test_endpoint_availability() {
    log_info "Testing endpoint availability..."
    
    # Test if the server is running
    if curl -s --connect-timeout 10 "$BASE_URL/api/health" > /dev/null 2>&1; then
        log_success "Server is responding at $BASE_URL"
    elif curl -s --connect-timeout 10 "$BASE_URL" > /dev/null 2>&1; then
        log_success "Server is responding at $BASE_URL"
        log_warning "Health endpoint not available"
    else
        log_error "Server not responding at $BASE_URL"
        if [[ "$ENVIRONMENT" == "local" ]]; then
            log_info "Make sure your local development server is running:"
            log_info "  npm run dev  # or"
            log_info "  vercel dev"
        fi
        exit 1
    fi
}

# Run utility function tests
run_utility_tests() {
    log_info "Running Slack utility function tests..."
    
    cd "$PROJECT_DIR"
    export TEST_BASE_URL="$BASE_URL"
    
    if node scripts/test-slack-utils.js; then
        log_success "Utility tests completed"
    else
        log_error "Utility tests failed"
        return 1
    fi
}

# Run command endpoint tests
run_command_tests() {
    log_info "Running Slack command endpoint tests..."
    
    cd "$PROJECT_DIR"
    export TEST_BASE_URL="$BASE_URL"
    
    if node scripts/test-slack-commands.js; then
        log_success "Command endpoint tests completed"
    else
        log_error "Command endpoint tests failed"
        return 1
    fi
}

# Test individual commands interactively
run_interactive_command_tests() {
    log_info "Running interactive command tests..."
    
    local commands=(
        "/rpg-help"
        "/rpg-status" 
        "/rpg-register test.user"
        "/rpg-leaderboard"
        "/rpg-teams"
        "/rpg-join frontend-warriors"
        "/rpg-achievements"
        "/rpg-guild-stats frontend-warriors"
    )
    
    for cmd in "${commands[@]}"; do
        log_info "Testing command: $cmd"
        
        cd "$PROJECT_DIR"
        export TEST_BASE_URL="$BASE_URL"
        
        if node scripts/test-slack-commands.js $cmd; then
            log_success "✓ $cmd"
        else
            log_warning "✗ $cmd (check logs for details)"
        fi
        
        # Brief pause between tests
        sleep 1
    done
}

# Test security features
test_security_features() {
    log_info "Testing security features..."
    
    local test_count=0
    local success_count=0
    
    # Test 1: Invalid signature should be rejected
    log_info "Test 1: Invalid signature rejection"
    test_count=$((test_count + 1))
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "X-Slack-Signature: v0=invalid-signature" \
        -H "X-Slack-Request-Timestamp: $(date +%s)" \
        -d "command=/rpg-help&user_id=U123&user_name=test" \
        "$BASE_URL/api/slack-commands")
    
    if echo "$response" | grep -q "error.*Unauthorized\\|error.*401" || \
       curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "X-Slack-Signature: v0=invalid-signature" \
        -H "X-Slack-Request-Timestamp: $(date +%s)" \
        -d "command=/rpg-help" \
        "$BASE_URL/api/slack-commands" | grep -q "401"; then
        log_success "✓ Invalid signature correctly rejected"
        success_count=$((success_count + 1))
    else
        log_warning "✗ Invalid signature not rejected"
    fi
    
    # Test 2: Old timestamp should be rejected
    log_info "Test 2: Old timestamp rejection"
    test_count=$((test_count + 1))
    
    old_timestamp=$(($(date +%s) - 400))  # 6+ minutes ago
    response=$(curl -s -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "X-Slack-Signature: v0=old-signature" \
        -H "X-Slack-Request-Timestamp: $old_timestamp" \
        -d "command=/rpg-help&user_id=U123" \
        "$BASE_URL/api/slack-commands")
    
    if echo "$response" | grep -q "error.*Unauthorized\\|error.*401" || \
       curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "X-Slack-Signature: v0=old-signature" \
        -H "X-Slack-Request-Timestamp: $old_timestamp" \
        -d "command=/rpg-help" \
        "$BASE_URL/api/slack-commands" | grep -q "401"; then
        log_success "✓ Old timestamp correctly rejected"
        success_count=$((success_count + 1))
    else
        log_warning "✗ Old timestamp not rejected"
    fi
    
    log_info "Security tests: $success_count/$test_count passed"
}

# Performance tests
run_performance_tests() {
    log_info "Running basic performance tests..."
    
    # Test response times for different commands
    local commands=("/rpg-help" "/rpg-status" "/rpg-leaderboard")
    local total_time=0
    local test_count=0
    
    for cmd in "${commands[@]}"; do
        log_info "Testing response time for: $cmd"
        
        cd "$PROJECT_DIR"
        export TEST_BASE_URL="$BASE_URL"
        
        start_time=$(date +%s.%N)
        node scripts/test-slack-commands.js "$cmd" > /dev/null 2>&1
        end_time=$(date +%s.%N)
        
        duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        duration_ms=$(echo "$duration * 1000" | bc -l 2>/dev/null || echo "0")
        
        if [[ $(echo "$duration_ms > 0" | bc -l 2>/dev/null || echo "0") == "1" ]]; then
            printf "   Response time: %.0fms\n" "$duration_ms"
            total_time=$(echo "$total_time + $duration_ms" | bc -l 2>/dev/null || echo "$total_time")
            test_count=$((test_count + 1))
        fi
    done
    
    if [[ $test_count -gt 0 ]]; then
        avg_time=$(echo "scale=0; $total_time / $test_count" | bc -l 2>/dev/null || echo "0")
        log_info "Average response time: ${avg_time}ms"
        
        if [[ $(echo "$avg_time < 3000" | bc -l 2>/dev/null || echo "0") == "1" ]]; then
            log_success "Performance: Good (< 3s average)"
        else
            log_warning "Performance: Slow (> 3s average)"
        fi
    fi
}

# Generate test report
generate_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="$SCRIPT_DIR/slack-integration-report-$(date +%Y%m%d-%H%M%S).txt"
    
    log_info "Generating test report..."
    
    cat > "$report_file" << EOF
JIRA RPG Slack Integration Test Report
=====================================
Date: $timestamp
Environment: $ENVIRONMENT
Base URL: $BASE_URL
Node Version: $(node --version 2>/dev/null || echo "Unknown")

Test Results:
- Utility Function Tests: $(node scripts/test-slack-utils.js > /dev/null 2>&1 && echo "✅ PASS" || echo "❌ FAIL")
- Command Endpoint Tests: $(node scripts/test-slack-commands.js > /dev/null 2>&1 && echo "✅ PASS" || echo "❌ FAIL")
- Security Features: Tested
- Performance: Tested

Environment Variables:
- SLACK_SIGNING_SECRET: $(test -n "$SLACK_SIGNING_SECRET" && echo "✅ Set" || echo "❌ Not Set")
- SLACK_BOT_TOKEN: $(test -n "$SLACK_BOT_TOKEN" && echo "✅ Set" || echo "❌ Not Set")

Notes:
- All tests completed at $timestamp
- Check console output for detailed results
- For production issues, verify Slack app configuration
EOF

    log_success "Report saved to: $report_file"
}

# Main test execution
main() {
    echo "🎮 JIRA RPG Slack Integration Test Suite"
    echo "========================================"
    
    # Run all test phases
    check_prerequisites
    test_endpoint_availability
    
    echo
    log_info "Starting comprehensive test suite..."
    echo
    
    # Core functionality tests
    run_utility_tests
    echo
    
    run_command_tests  
    echo
    
    # Security and performance tests
    test_security_features
    echo
    
    run_performance_tests
    echo
    
    # Interactive testing
    read -p "Run interactive command tests? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_interactive_command_tests
        echo
    fi
    
    # Generate report
    generate_report
    
    echo
    log_success "🎉 Integration test suite completed!"
    echo
    log_info "Next steps:"
    echo "  • Check test report for detailed results"
    echo "  • Verify Slack app configuration if tests failed"
    echo "  • Test with real Slack workspace for full validation"
    echo "  • Monitor server logs for additional insights"
}

# Execute main function
main "$@"