import prisma from '../config/database';

/**
 * Test script for YooKassa payment gateway integration
 * 
 * This script:
 * 1. Creates or updates a YooKassa payment gateway with test credentials
 * 2. Tests creating a payment via YooKassa API
 * 3. Provides test card details for testing
 * 
 * Test credentials:
 * - Shop ID: Get from YooKassa dashboard (test shop)
 * - Secret Key: Get from YooKassa dashboard (test shop)
 * 
 * Test card: 5555 5555 5555 4444
 * - Any CVC code
 * - Any future expiration date
 */

interface YooKassaPaymentRequest {
  amount: {
    value: string;
    currency: string;
  };
  capture: boolean;
  confirmation: {
    type: string;
    return_url: string;
  };
  description: string;
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  created_at: string;
  description: string;
  test: boolean;
}

async function createOrUpdateYooKassaGateway() {
  console.log('🔧 Setting up YooKassa payment gateway...');

  // Test credentials - shop_id, gate_id — the same in YooKassa
  const testShopId = process.env.YOOKASSA_TEST_SHOP_ID || process.env.YOOKASSA_GATE_ID || 'YOUR_TEST_SHOP_ID';
  const testSecretKey = process.env.YOOKASSA_TEST_SECRET_KEY || 'YOUR_TEST_SECRET_KEY';

  if (testShopId === 'YOUR_TEST_SHOP_ID' || testSecretKey === 'YOUR_TEST_SECRET_KEY') {
    console.log('⚠️  Using placeholder credentials. Please set YOOKASSA_TEST_SHOP_ID and YOOKASSA_TEST_SECRET_KEY environment variables.');
    console.log('   Or update the script with your test shop credentials.');
    console.log('   Get test credentials from: https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start');
  }

  const gatewayData = {
    type: 'YOOKASSA',
    name: 'YooKassa (Test)',
    isEnabled: true,
    isTestMode: true,
    config: {
      shopId: testShopId,
      secretKey: testSecretKey,
    },
    supportedCountries: ['RU'], // YooKassa primarily supports Russia
    supportedCurrencies: ['RUB'], // YooKassa primarily uses RUB
    sortOrder: 0,
  };

  try {
    // Check if gateway already exists
    const existingGateway = await prisma.paymentGateway.findUnique({
      where: { type: 'YOOKASSA' },
    });

    if (existingGateway) {
      console.log('📝 Updating existing YooKassa gateway...');
      await prisma.paymentGateway.update({
        where: { id: existingGateway.id },
        data: gatewayData,
      });
      console.log('✅ YooKassa gateway updated successfully');
    } else {
      console.log('➕ Creating new YooKassa gateway...');
      const gateway = await prisma.paymentGateway.create({
        data: gatewayData,
      });
      console.log('✅ YooKassa gateway created successfully');
      console.log(`   Gateway ID: ${gateway.id}`);
    }
  } catch (error) {
    console.error('❌ Failed to create/update YooKassa gateway:', error);
    throw error;
  }
}

async function testYooKassaPayment() {
  console.log('\n🧪 Testing YooKassa payment creation...');

  const gateway = await prisma.paymentGateway.findUnique({
    where: { type: 'YOOKASSA' },
  });

  if (!gateway) {
    throw new Error('YooKassa gateway not found. Please run createOrUpdateYooKassaGateway first.');
  }

  const config = gateway.config as { shopId?: string; secretKey?: string };

  if (!config.shopId || !config.secretKey) {
    throw new Error('YooKassa gateway configuration is incomplete. Please set shopId and secretKey.');
  }

  if (config.shopId === 'YOUR_TEST_SHOP_ID' || config.secretKey === 'YOUR_TEST_SECRET_KEY') {
    console.log('⚠️  Using placeholder credentials. Payment test will fail.');
    console.log('   Please update the gateway configuration with real test credentials.');
    return;
  }

  // Create test payment
  const paymentData: YooKassaPaymentRequest = {
    amount: {
      value: '100.00',
      currency: 'RUB',
    },
    capture: true,
    confirmation: {
      type: 'redirect',
      return_url: 'https://www.example.com/return_url',
    },
    description: 'Test payment from Fashion E-commerce Platform',
  };

  try {
    const idempotenceKey = `test-${Date.now()}`;
    
    console.log('📤 Sending payment creation request to YooKassa...');
    console.log(`   Amount: ${paymentData.amount.value} ${paymentData.amount.currency}`);
    console.log(`   Description: ${paymentData.description}`);

    // Create Basic Auth header
    const authHeader = Buffer.from(`${config.shopId}:${config.secretKey}`).toString('base64');

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`YooKassa API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const payment = (await response.json()) as YooKassaPaymentResponse;

    console.log('\n✅ Payment created successfully!');
    console.log(`   Payment ID: ${payment.id}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Amount: ${payment.amount.value} ${payment.amount.currency}`);
    console.log(`   Test mode: ${payment.test ? 'Yes' : 'No'}`);
    
    if (payment.confirmation?.confirmation_url) {
      console.log(`\n🔗 Confirmation URL: ${payment.confirmation.confirmation_url}`);
      console.log('\n📋 Test Card Details:');
      console.log('   Card Number: 5555 5555 5555 4444');
      console.log('   CVC: Any 3-digit code (e.g., 123)');
      console.log('   Expiry: Any future date (e.g., 12/25)');
      console.log('\n💡 Open the confirmation URL in your browser to test the payment.');
    }

    return payment;
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 YooKassa Integration Test Script\n');
    console.log('=' .repeat(50));

    // Step 1: Create or update gateway
    await createOrUpdateYooKassaGateway();

    // Step 2: Test payment creation
    await testYooKassaPayment();

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests completed successfully!');
    console.log('\n📚 Documentation:');
    console.log('   https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start');
    console.log('\n🔑 To get test credentials:');
    console.log('   1. Register at https://yookassa.ru');
    console.log('   2. Get test shop ID and secret key from dashboard');
    console.log('   3. Set YOOKASSA_TEST_SHOP_ID and YOOKASSA_TEST_SECRET_KEY environment variables');
    console.log('   4. Or update the gateway configuration in admin panel');
  } catch (error) {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { createOrUpdateYooKassaGateway, testYooKassaPayment };
