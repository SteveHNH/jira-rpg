#!/bin/bash

# Test script to send JIRA webhook payload to local vercel dev instance

echo "Testing JIRA webhook locally..."

curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Atlassian-Webhook-Identifier: test-webhook" \
  -d @test-webhook-payload.json \
  --verbose

echo ""
echo "Webhook test completed. Check your vercel dev console for logs!"