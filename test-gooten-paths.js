import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GOOTEN_RECIPE_ID = process.env.GOOTEN_RECIPE_ID;
const BASE_URL = 'https://api.print.io';

const pathsToTest = [
  {
    name: 'PRP Products v1',
    path: '/api/v/1/source/api/preconfiguredproducts/',
    params: { recipeid: GOOTEN_RECIPE_ID, countryCode: 'US' }
  },
  {
    name: 'PRP Products (no version)',
    path: '/preconfiguredproducts/',
    params: { recipeid: GOOTEN_RECIPE_ID, countryCode: 'US' }
  },
  {
    name: 'Product Templates v5',
    path: '/api/v/5/source/api/producttemplates/',
    params: { recipeid: GOOTEN_RECIPE_ID, sku: 'canvas-16x20-wrap' }
  },
  {
    name: 'Product Templates v4',
    path: '/api/v/4/source/api/producttemplates/',
    params: { recipeid: GOOTEN_RECIPE_ID, sku: 'canvas-16x20-wrap' }
  },
  {
    name: 'Product Templates (no version)',
    path: '/producttemplates/',
    params: { recipeid: GOOTEN_RECIPE_ID, sku: 'canvas-16x20-wrap' }
  },
];

async function testPath(test) {
  const url = `${BASE_URL}${test.path}`;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${test.name}`);
  console.log(`URL: ${url}`);
  console.log(`Params:`, test.params);
  console.log('='.repeat(70));

  try {
    const response = await axios.get(url, {
      params: test.params,
      timeout: 10000,
      validateStatus: () => true
    });

    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);

    if (typeof response.data === 'string') {
      console.log('Response is STRING (likely HTML error)');
      if (response.data.includes('<!DOCTYPE')) {
        console.log('✗ FAILED: Got HTML page instead of JSON');
      } else {
        console.log('Response preview:', response.data.substring(0, 200));
      }
    } else {
      console.log('✓ SUCCESS: Got JSON response');
      console.log('Response keys:', Object.keys(response.data).slice(0, 10));
    }
  } catch (error) {
    console.log('✗ ERROR:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Content-Type:', error.response.headers['content-type']);
    }
  }

  await new Promise(r => setTimeout(r, 1000));
}

async function runTests() {
  console.log('\n🔍 Testing Gooten API Paths...\n');
  console.log(`Recipe ID: ${GOOTEN_RECIPE_ID}\n`);

  for (const test of pathsToTest) {
    await testPath(test);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ All tests complete!');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
