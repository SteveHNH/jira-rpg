#!/bin/bash

# test-xp-system.sh - Comprehensive XP and Level Progression Test Suite
# Usage: ./scripts/test-xp-system.sh [--unit] [--integration] [--webhook] [--all] [--verbose]

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_TYPE="${1:-all}"
VERBOSE="${2:-}"

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
    echo "██████████████████████████████████████████████"
    echo "█                                            █"
    echo "█   🗡️  JIRA RPG XP SYSTEM TEST SUITE  ⚔️     █"
    echo "█                                            █"
    echo "██████████████████████████████████████████████"
    echo -e "${NC}"
    echo "Testing XP awards, level progression, and user service"
    echo "Base URL: $BASE_URL"
    echo "Test Type: $TEST_TYPE"
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

run_unit_tests() {
    print_section "Unit Tests - XP Calculator"
    
    print_step "Running XP Calculator unit tests..."
    
    if command -v node >/dev/null 2>&1; then
        cd "$(dirname "$0")/.."
        
        # Check if the test file exists
        if [[ ! -f "lib/xp-calculator.test.js" ]]; then
            print_error "XP Calculator test file not found: lib/xp-calculator.test.js"
            return 1
        fi
        
        # Run the unit tests using Node.js (ES modules)
        if node lib/xp-calculator.test.js; then
            print_success "XP Calculator unit tests completed"
            return 0
        else
            print_error "XP Calculator unit tests failed"
            return 1
        fi
    else
        print_warning "Node.js not available, skipping unit tests"
        return 1
    fi
}

run_integration_tests() {
    print_section "Integration Tests - User Service"
    
    print_step "Running User Service integration tests..."
    
    if command -v node >/dev/null 2>&1; then
        cd "$(dirname "$0")/.."
        
        # Check if the test file exists
        if [[ ! -f "lib/user-service.test.js" ]]; then
            print_error "User Service test file not found: lib/user-service.test.js"
            return 1
        fi
        
        # Run the integration tests using Node.js (ES modules)
        # Capture output and check for test success despite Firebase warnings
        local test_output
        test_output=$(node lib/user-service.test.js 2>&1)
        echo "$test_output"
        
        if echo "$test_output" | grep -q "All integration tests passed"; then
            print_success "User Service integration tests completed"
            return 0
        else
            print_error "User Service integration tests failed"
            return 1
        fi
    else
        print_warning "Node.js not available, skipping integration tests"
        return 1
    fi
}

test_xp_webhook_scenario() {
    local scenario="$1"
    local description="$2"
    local expected_xp="$3"
    
    print_step "Testing XP webhook scenario: $description"
    
    local response
    if response=$(curl -s -X POST "$BASE_URL/api/test?scenario=$scenario"); then
        if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
            # Extract XP information from response
            local xp_awarded
            if xp_awarded=$(echo "$response" | jq -r '.processingDetails.xpAwarded // 0'); then
                if [[ "$expected_xp" != "any" && "$xp_awarded" -ne "$expected_xp" ]]; then
                    print_error "$description - Expected ${expected_xp} XP, got ${xp_awarded} XP"
                    return 1
                else
                    print_success "$description - Awarded ${xp_awarded} XP"
                    
                    # Check for level up information
                    local level_up
                    if level_up=$(echo "$response" | jq -r '.processingDetails.levelUp // null'); then
                        if [[ "$level_up" != "null" ]]; then
                            local old_level new_level
                            old_level=$(echo "$level_up" | jq -r '.oldLevel')
                            new_level=$(echo "$level_up" | jq -r '.newLevel')
                            print_info "  Level up detected: $old_level → $new_level"
                        fi
                    fi
                    
                    return 0
                fi
            else
                print_error "$description - Could not extract XP information"
                return 1
            fi
        else
            print_error "$description - Webhook processing failed"
            return 1
        fi
    else
        print_error "$description - Request failed"
        return 1
    fi
}

test_custom_xp_scenarios() {
    print_step "Testing custom XP scenarios..."
    
    # Test bug fix with story points
    local bug_payload='{
        "webhookEvent": "jira:issue_updated",
        "issue": {
            "key": "TEST-BUG-001",
            "fields": {
                "summary": "Critical bug fix with story points",
                "issuetype": {"name": "Bug"},
                "status": {"name": "Done"},
                "customfield_10016": 5,
                "assignee": {
                    "name": "test.dev",
                    "emailAddress": "test.dev@company.com",
                    "displayName": "Test Developer"
                }
            }
        },
        "user": {
            "name": "test.dev",
            "emailAddress": "test.dev@company.com",
            "displayName": "Test Developer"
        },
        "changelog": {
            "items": [{
                "field": "status",
                "fromString": "In Progress", 
                "toString": "Done"
            }]
        }
    }'
    
    local response
    if response=$(curl -s -X POST "$BASE_URL/api/test" -H "Content-Type: application/json" -d "$bug_payload"); then
        if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
            local xp_awarded
            xp_awarded=$(echo "$response" | jq -r '.processingDetails.xpAwarded')
            
            # Should be 50 (completion) + 50 (5 story points * 10) + 25 (bug bonus) = 125 XP
            if [[ "$xp_awarded" -eq 125 ]]; then
                print_success "Bug fix with story points - Correct XP awarded: ${xp_awarded}"
            else
                print_error "Bug fix with story points - Expected 125 XP, got ${xp_awarded} XP"
                return 1
            fi
        else
            print_error "Custom bug fix scenario failed"
            return 1
        fi
    else
        print_error "Custom bug fix scenario request failed"
        return 1
    fi
}

run_webhook_xp_tests() {
    print_section "Webhook XP System Tests"
    
    # Check if server is running
    if ! curl -s "$BASE_URL/api/test" >/dev/null 2>&1; then
        print_error "Development server not responding at $BASE_URL"
        print_info "Please ensure 'vercel dev' is running"
        return 1
    fi
    
    local tests_passed=0
    local tests_failed=0
    
    # Test standard scenarios
    if test_xp_webhook_scenario "inProgress" "Ticket moved to In Progress" 15; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    if test_xp_webhook_scenario "done" "Ticket completed (with story points)" "any"; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    # Test custom scenarios
    if test_custom_xp_scenarios; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    # Test level progression simulation
    print_step "Testing level progression simulation..."
    local progression_payload='{
        "webhookEvent": "jira:issue_updated",
        "issue": {
            "key": "PROG-001",
            "fields": {
                "summary": "High XP test ticket for progression",
                "issuetype": {"name": "Story"},
                "status": {"name": "Done"},
                "customfield_10016": 8,
                "assignee": {
                    "name": "progression.tester",
                    "emailAddress": "progression.tester@company.com",
                    "displayName": "Progression Tester"
                }
            }
        },
        "user": {
            "name": "progression.tester", 
            "emailAddress": "progression.tester@company.com",
            "displayName": "Progression Tester"
        },
        "changelog": {
            "items": [{
                "field": "status",
                "fromString": "In Progress",
                "toString": "Done"
            }]
        }
    }'
    
    # Award multiple times to same user to test progression
    for i in {1..5}; do
        if curl -s -X POST "$BASE_URL/api/test" -H "Content-Type: application/json" -d "$progression_payload" >/dev/null 2>&1; then
            print_info "  Progression test $i/5 completed"
        else
            print_error "Progression test $i failed"
            ((tests_failed++))
            break
        fi
    done
    
    if [[ $i -eq 5 ]]; then
        print_success "Level progression simulation completed"
        ((tests_passed++))
    fi
    
    echo ""
    print_info "Webhook XP Tests: $tests_passed passed, $tests_failed failed"
    
    if [[ $tests_failed -eq 0 ]]; then
        return 0
    else
        return 1
    fi
}

run_comprehensive_xp_validation() {
    print_section "Comprehensive XP System Validation"
    
    print_step "Validating XP calculation consistency..."
    
    # Test that our webhook endpoint calculations match our unit test expectations
    local validation_scenarios=(
        "inProgress:15"      # Should award 15 XP for In Progress
        "done:50"           # Should award at least 50 XP for completion (may have story point bonus)
    )
    
    for scenario_test in "${validation_scenarios[@]}"; do
        IFS=':' read -r scenario expected_base_xp <<< "$scenario_test"
        
        local response
        if response=$(curl -s -X POST "$BASE_URL/api/test?scenario=$scenario"); then
            if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
                local xp_awarded
                xp_awarded=$(echo "$response" | jq -r '.processingDetails.xpAwarded')
                
                if [[ "$xp_awarded" -ge "$expected_base_xp" ]]; then
                    print_success "XP validation for $scenario: ${xp_awarded} XP (≥ ${expected_base_xp} expected)"
                else
                    print_error "XP validation for $scenario: ${xp_awarded} XP (< ${expected_base_xp} expected)"
                    return 1
                fi
            else
                print_error "XP validation for $scenario failed - invalid response"
                return 1
            fi
        else
            print_error "XP validation for $scenario failed - request failed"
            return 1
        fi
    done
    
    print_success "XP system validation completed"
    return 0
}

# Main execution
print_banner

case "$TEST_TYPE" in
    "unit")
        if run_unit_tests; then
            print_success "🎉 Unit tests completed successfully!"
            exit 0
        else
            print_error "Unit tests failed"
            exit 1
        fi
        ;;
        
    "integration") 
        if run_integration_tests; then
            print_success "🎉 Integration tests completed successfully!"
            exit 0
        else
            print_error "Integration tests failed"
            exit 1
        fi
        ;;
        
    "webhook")
        if run_webhook_xp_tests && run_comprehensive_xp_validation; then
            print_success "🎉 Webhook XP tests completed successfully!"
            exit 0
        else
            print_error "Webhook XP tests failed"
            exit 1
        fi
        ;;
        
    "all"|"")
        overall_success=true
        
        echo ""
        print_info "Running complete XP system test suite..."
        echo ""
        
        # Run unit tests
        if run_unit_tests; then
            print_success "✅ Unit tests passed"
        else
            print_error "❌ Unit tests failed"
            overall_success=false
        fi
        
        echo ""
        
        # Run integration tests
        if run_integration_tests; then
            print_success "✅ Integration tests passed"
        else
            print_error "❌ Integration tests failed"
            overall_success=false
        fi
        
        echo ""
        
        # Run webhook XP tests
        if run_webhook_xp_tests && run_comprehensive_xp_validation; then
            print_success "✅ Webhook XP tests passed"
        else
            print_error "❌ Webhook XP tests failed"
            overall_success=false
        fi
        
        echo ""
        print_section "Final Results"
        
        if $overall_success; then
            print_success "🎉 ALL XP SYSTEM TESTS PASSED!"
            echo ""
            print_info "Your XP and level progression system is fully validated:"
            echo "  • Level progression (1-20) ✅"
            echo "  • XP award calculations ✅"
            echo "  • Title progression system ✅"
            echo "  • Level-up detection ✅"
            echo "  • Database integration ✅"
            echo "  • Webhook XP processing ✅"
            echo ""
            exit 0
        else
            print_error "❌ Some XP system tests failed"
            echo ""
            print_info "Please review the test output above and fix any issues"
            echo ""
            exit 1
        fi
        ;;
        
    *)
        print_error "Unknown test type: $TEST_TYPE"
        echo ""
        echo "Available test types:"
        echo "  unit        - Run unit tests for XP calculator"
        echo "  integration - Run integration tests for user service"
        echo "  webhook     - Run webhook XP system tests"
        echo "  all         - Run complete test suite (default)"
        echo ""
        echo "Usage: $0 [test-type] [--verbose]"
        exit 1
        ;;
esac