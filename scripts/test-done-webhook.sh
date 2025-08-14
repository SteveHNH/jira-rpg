#!/bin/bash

# Test script to send JIRA webhook payload for a DONE task to local vercel dev instance

echo "Testing JIRA webhook for COMPLETED task locally..."

curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Atlassian-Webhook-Identifier: test-webhook" \
  -d @test-webhook-done-payload.json \
  --verbose

echo ""
echo "Done webhook test completed. Check your vercel dev console for logs!"