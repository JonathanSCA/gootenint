import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GOOTEN_RECIPE_ID = process.env.GOOTEN_RECIPE_ID;
const BASE_URL = 'https://api.print.io';

async function test1_PRPProducts() {
  console.log('\n' + '='.repeat(70));
  console.log('Test 1: PRP Products');
  console.log('='.repeat(70));

  const url = `${BASE_URL}/api/v/1/source/api/preconfiguredproducts/`;
  const params = {
    RecipeId: GOOTEN_RECIPE_ID,
    countryCode: 'US'
  };

  console.log('URL:', url);
  console.log('Params:', params);

  try {
    const response = await axios.get(url, {
      params,
      timeout: 15000
    });

    console.log('✓ Status:', response.status);
    console.log('✓ Got JSON response');
    console.log('Response keys:', Object.keys(response.data));
    if (response.data.PreconfiguredProducts) {
      console.log(`Found ${response.data.PreconfiguredProducts.length} products`);
    }
    return response.data;
  } catch (error) {
    console.log('✗ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
    return null;
  }
}

async function test2_PRPVariants() {
  console.log('\n' + '='.repeat(70));
  console.log('Test 2: PRP Variants');
  console.log('='.repeat(70));

  const url = `${BASE_URL}/api/v/1/source/api/preconfiguredproducts/variants/`;
  const params = {
    RecipeId: GOOTEN_RECIPE_ID,
    countryCode: 'US',
    productName: 'Canvas'
  };

  console.log('URL:', url);
  console.log('Params:', params);

  try {
    const response = await axios.get(url, {
      params,
      timeout: 15000
    });

    console.log('✓ Status:', response.status);
    console.log('✓ Got JSON response');
    console.log('Response keys:', Object.keys(response.data));
    if (response.data.ProductVariants && response.data.ProductVariants[0]) {
      const sku = response.data.ProductVariants[0].Sku;
      console.log(`Found first SKU: ${sku}`);
      return sku;
    }
    return null;
  } catch (error) {
    console.log('✗ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
    return null;
  }
}

async function test3_ProductTemplates(sku) {
  console.log('\n' + '='.repeat(70));
  console.log('Test 3: Product Templates');
  console.log('='.repeat(70));

  if (!sku) {
    console.log('✗ No SKU available, skipping test');
    return;
  }

  const url = `${BASE_URL}/api/v/5/source/api/producttemplates/`;
  const params = {
    RecipeId: GOOTEN_RECIPE_ID,
    sku: sku
  };

  console.log('URL:', url);
  console.log('Params:', params);

  try {
    const response = await axios.get(url, {
      params,
      timeout: 15000
    });

    console.log('✓ Status:', response.status);
    console.log('✓ Got JSON response');
    console.log('Response keys:', Object.keys(response.data));
  } catch (error) {
    console.log('✗ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function runTests() {
  console.log('\n🔍 Testing Gooten API with corrected parameters...\n');
  console.log(`Recipe ID: ${GOOTEN_RECIPE_ID}\n`);

  await test1_PRPProducts();
  await new Promise(r => setTimeout(r, 1000));

  const sku = await test2_PRPVariants();
  await new Promise(r => setTimeout(r, 1000));

  await test3_ProductTemplates(sku);

  console.log('\n' + '='.repeat(70));
  console.log('✅ All tests complete!');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
