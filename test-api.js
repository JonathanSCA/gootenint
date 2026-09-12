import axios from 'axios';

const API_BASE = 'http://localhost:3001';

async function testEndpoint(name, url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  try {
    const response = await axios.get(url);
    console.log('✓ Success!');
    console.log('Status:', response.status);
    console.log('Cached:', response.data.cached);
    console.log('Data keys:', Object.keys(response.data.data || {}).slice(0, 5));
    return response.data;
  } catch (error) {
    console.log('✗ Failed!');
    console.log('Error:', error.response?.data?.error || error.message);
    console.log('Details:', error.response?.data?.details);
    return null;
  }
}

async function runTests() {
  console.log('Starting API Tests...\n');

  console.log('Test 1: Get all products');
  await testEndpoint(
    'Get All Products',
    `${API_BASE}/api/prp-products?countryCode=US`
  );

  await new Promise(r => setTimeout(r, 1000));

  console.log('\n\nTest 2: Get product variants');
  await testEndpoint(
    'Get Product Variants',
    `${API_BASE}/api/prp-variants?productName=Canvas&countryCode=US`
  );

  await new Promise(r => setTimeout(r, 1000));

  console.log('\n\nTest 3: Get real SKUs');
  const skuResponse = await testEndpoint(
    'Get SKUs',
    `${API_BASE}/api/product-skus?productName=Canvas&countryCode=US`
  );

  if (skuResponse?.data?.ProductVariants?.[0]?.Sku) {
    const sku = skuResponse.data.ProductVariants[0].Sku;
    console.log(`\nFound SKU: ${sku}`);

    await new Promise(r => setTimeout(r, 1000));

    console.log('\n\nTest 4: Get product content with real SKU');
    await testEndpoint(
      'Get Product Content',
      `${API_BASE}/api/product-content/${sku}?countryCode=US`
    );

    await new Promise(r => setTimeout(r, 1000));

    console.log('\n\nTest 5: Get product images with real SKU');
    await testEndpoint(
      'Get Product Images',
      `${API_BASE}/api/product-images/${sku}`
    );
  } else {
    console.log('\n✗ Could not get SKU from product variants');
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('Tests complete!');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
