# JIRA RPG Testing Scripts

This directory contains automated testing scripts to streamline development and testing workflows.

## Quick Start

```bash
# Run all tests
npm test

# Quick health check
npm run test:health

# Fast test suite (skips performance tests)
npm test:fast
```

## Available Scripts

### Comprehensive Testing
- `npm test` - Full test suite with health check, webhooks, story generation, and performance
- `npm test:fast` - Quick test suite (skips integration and performance tests)
- `npm run test:health` - System health check only

### Webhook Testing
- `npm run test:webhook` - All webhook scenarios
- `npm run webhook:list` - Show available webhook test scenarios  
- `npm run webhook:progress` - Test "In Progress" webhook scenario
- `npm run webhook:done` - Test "Done" webhook scenario

### Story Generation Testing
- `npm run test:story` - Full story generation test suite
- `npm run story:health` - Check Ollama API health
- `npm run story:generate` - Test AI story generation
- `npm run story:guild` - Test guild extraction from JIRA data
- `npm run story:benchmark` - Performance test (5 story generation requests)

## Direct Script Usage

All scripts can also be run directly with additional options:

### test-webhook.sh
```bash
# List available scenarios
./scripts/test-webhook.sh list

# Test specific scenario with pretty JSON
./scripts/test-webhook.sh inProgress --pretty

# Test all webhook scenarios
./scripts/test-webhook.sh all

# Test with custom payload
./scripts/test-webhook.sh custom
```

### test-story.sh
```bash
# Test story generation with pretty output
./scripts/test-story.sh story --pretty

# Run full test suite
./scripts/test-story.sh full

# Performance benchmark
./scripts/test-story.sh benchmark
```

### health-check.sh
```bash
# Basic health check
./scripts/health-check.sh

# Verbose health check with detailed output
./scripts/health-check.sh --verbose --pretty
```

### test-all.sh
```bash
# Full comprehensive test suite
./scripts/test-all.sh

# Fast mode (skips performance tests)
./scripts/test-all.sh --fast

# Verbose output with pretty JSON
./scripts/test-all.sh --verbose --pretty
```

## Environment Variables

All scripts respect these environment variables:

- `BASE_URL` - Override the base URL (default: `http://localhost:3000`)

Example:
```bash
BASE_URL=https://your-app.vercel.app npm test
```

## Prerequisites

1. **Development Server**: Ensure `vercel dev` is running
2. **Environment**: Configure `.env.local` with required credentials
3. **Dependencies**: Install with `npm install`
4. **Optional**: Install `jq` for pretty JSON formatting

## Common Workflows

### Development Testing
```bash
# Start development server
npm run dev

# In another terminal, run health check
npm run test:health

# Test webhook processing
npm run webhook:progress

# Test story generation
npm run story:generate
```

### Pre-deployment Testing
```bash
# Run full test suite
npm test

# If tests pass, deploy
vercel --prod
```

### Debugging Issues
```bash
# Check system health first
npm run test:health

# Test specific component that's failing
npm run story:health  # for AI issues
npm run webhook:list  # for webhook issues

# Run with verbose output
./scripts/health-check.sh --verbose
```

### Performance Monitoring
```bash
# Benchmark story generation
npm run story:benchmark

# Full performance test
./scripts/test-all.sh
```

## Script Features

### Colored Output
All scripts use colored output for easy identification:
- ✅ Green: Success
- ❌ Red: Errors  
- ⚠️ Yellow: Warnings
- ℹ️ Blue: Information
- 🔄 Cyan: In Progress

### Error Handling
- Scripts exit with appropriate codes (0 for success, 1 for failure)
- Detailed error messages for debugging
- Graceful handling of missing dependencies

### JSON Formatting
- Use `--pretty` flag for formatted JSON output
- Requires `jq` to be installed
- Falls back to raw output if `jq` unavailable

## Troubleshooting

### "Permission denied" errors
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

### "Command not found: vercel"
```bash
# Install Vercel CLI
npm install -g vercel
```

### "jq: command not found"
```bash
# Install jq for JSON formatting (optional)
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### Tests failing with connection errors
```bash
# Ensure development server is running
npm run dev

# Check if server is responding
curl http://localhost:3000/api/test
```

## Adding New Tests

To add new test scenarios:

1. **For Webhooks**: Edit `test-webhook.sh` and add new scenarios to the case statement
2. **For Stories**: Edit `test-story.sh` and add new test types
3. **For Health**: Edit `health-check.sh` and add new checks
4. **Add NPM Scripts**: Update `package.json` scripts section

Example:
```bash
# Add to package.json
"webhook:custom": "./scripts/test-webhook.sh custom"
```

## Integration with CI/CD

These scripts are designed to work in CI/CD environments:

```yaml
# GitHub Actions example
- name: Run health check
  run: npm run test:health

- name: Run full test suite
  run: npm test
```

## Performance Expectations

Typical response times on local development:
- Health checks: < 1 second
- Webhook tests: < 2 seconds  
- Story generation: 2-5 seconds (depends on Ollama API)
- Full test suite: 30-60 seconds