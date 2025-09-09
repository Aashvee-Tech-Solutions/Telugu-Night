#!/usr/bin/env node

/**
 * Automated Webhook Testing Script for Cashfree
 * This script tests the webhook endpoint to ensure it works with Cashfree's validation
 */

import http from 'http';

const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/cashfree';

// Test cases for webhook validation
const testCases = [
  {
    name: 'GET Request (Cashfree Validation)',
    method: 'GET',
    expectedStatus: 200,
    expectedBody: 'OK'
  },
  {
    name: 'POST with Valid Payload',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'test_signature',
      'x-webhook-timestamp': Math.floor(Date.now() / 1000).toString()
    },
    body: JSON.stringify({
      order_id: 'test_order_' + Date.now(),
      order_status: 'PAID',
      payment_amount: '100.00',
      cf_payment_id: 'test_payment',
      payment_method: 'upi'
    }),
    expectedStatus: 200
  },
  {
    name: 'POST with Missing order_id',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'test_signature',
      'x-webhook-timestamp': Math.floor(Date.now() / 1000).toString()
    },
    body: JSON.stringify({
      order_status: 'PAID',
      payment_amount: '100.00'
    }),
    expectedStatus: 200 // Should still return 200 per Cashfree requirements
  },
  {
    name: 'POST with Invalid JSON',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'test_signature',
      'x-webhook-timestamp': Math.floor(Date.now() / 1000).toString()
    },
    body: '{"invalid": json}',
    expectedStatus: 200 // Should still return 200 per Cashfree requirements
  }
];

async function runTest(testCase) {
  return new Promise((resolve) => {
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: testCase.method,
      headers: testCase.headers || {}
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        const success = res.statusCode === testCase.expectedStatus;
        const result = {
          name: testCase.name,
          success,
          actualStatus: res.statusCode,
          expectedStatus: testCase.expectedStatus,
          body: body.substring(0, 100), // Limit body output
          responseTime: Date.now() - startTime
        };
        resolve(result);
      });
    });

    req.on('error', (error) => {
      resolve({
        name: testCase.name,
        success: false,
        error: error.message
      });
    });

    const startTime = Date.now();
    
    if (testCase.body) {
      req.write(testCase.body);
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('🧪 Starting Automated Webhook Tests...\n');
  
  const results = [];
  for (const testCase of testCases) {
    console.log(`⏳ Running: ${testCase.name}`);
    const result = await runTest(testCase);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ PASS: ${result.name} (${result.actualStatus}) - ${result.responseTime}ms`);
    } else {
      console.log(`❌ FAIL: ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      } else {
        console.log(`   Expected: ${result.expectedStatus}, Got: ${result.actualStatus}`);
      }
    }
    console.log('');
  }
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Webhook endpoint is ready for Cashfree integration.');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed. Please check the webhook endpoint configuration.');
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, runTest };