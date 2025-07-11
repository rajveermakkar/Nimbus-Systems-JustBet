#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ALLOW_DIRECT_API_ACCESS = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_1234567890abcdef';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_1234567890abcdef';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/justbet_test';

console.log('🚀 Starting Payment End-to-End Tests...\n');

// Function to run tests with proper output
function runTests(testPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`📋 Running ${description}...`);
    
    const testProcess = spawn('npm', ['test', '--', testPath, '--verbose'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env }
    });

    let output = '';
    let errorOutput = '';

    testProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    testProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully!\n`);
        resolve({ success: true, output });
      } else {
        console.log(`❌ ${description} failed with code ${code}\n`);
        reject({ success: false, code, output, errorOutput });
      }
    });

    testProcess.on('error', (error) => {
      console.log(`❌ Failed to run ${description}: ${error.message}\n`);
      reject({ success: false, error: error.message });
    });
  });
}

// Main test runner
async function runPaymentTests() {
  const tests = [
    {
      path: 'tests/payment.test.js',
      description: 'Backend Payment Integration Tests'
    }
  ];

  console.log('🔧 Test Environment Setup:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   ALLOW_DIRECT_API_ACCESS: ${process.env.ALLOW_DIRECT_API_ACCESS}`);
  console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not Set'}`);
  console.log(`   STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'Not Set'}`);
  console.log('');

  const results = [];
  let allPassed = true;

  for (const test of tests) {
    try {
      const result = await runTests(test.path, test.description);
      results.push({ ...test, ...result });
    } catch (error) {
      results.push({ ...test, ...error });
      allPassed = false;
    }
  }

  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${index + 1}. ${result.description}: ${status}`);
  });

  console.log('');
  
  if (allPassed) {
    console.log('🎉 All payment tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some payment tests failed. Check the output above for details.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Payment Test Runner

Usage: node run-payment-tests.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Run tests with verbose output
  --watch, -w    Run tests in watch mode

Environment Variables:
  NODE_ENV                    Test environment (default: test)
  ALLOW_DIRECT_API_ACCESS     Allow direct API access (default: true)
  STRIPE_SECRET_KEY          Stripe test secret key
  STRIPE_WEBHOOK_SECRET      Stripe webhook secret
  JWT_SECRET                 JWT secret for testing
  DATABASE_URL               Test database URL

Examples:
  node run-payment-tests.js
  node run-payment-tests.js --verbose
  node run-payment-tests.js --watch
`);
  process.exit(0);
}

// Run the tests
runPaymentTests().catch((error) => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
}); 