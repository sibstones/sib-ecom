import prisma from '../config/database';
import Stripe from 'stripe';
import { CreatePaymentGatewayDto, UpdatePaymentGatewayDto, PaymentGatewayConfig } from '../types/payment-gateway';
import { decryptPaymentConfig, encryptPaymentConfig } from '../utils/crypto';
import {
  isManualPaymentGatewayType,
  isSupportedPaymentGatewayType,
} from '../constants/payment-gateway';

type GatewayRow = Awaited<ReturnType<typeof prisma.paymentGateway.findUnique>>;
type Gateway = NonNullable<GatewayRow>;
const SECRET_PLACEHOLDER = '***hidden***';

function isSecretConfigKey(key: string): boolean {
  const k = key.toLowerCase();
  if (k.includes('publishable') || k.includes('publicid') || k === 'clientid' || k === 'shopid') return false;
  return (
    k.includes('secret') ||
    k.includes('private') ||
    k.includes('token') ||
    k.includes('password') ||
    k.includes('apikey') ||
    k.includes('accesskey')
  );
}

function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && value && isSecretConfigKey(key)) {
      out[key] = SECRET_PLACEHOLDER;
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = maskConfigSecrets(value as Record<string, unknown>);
    }
  }
  return out;
}

function resolveConfigPlaceholders(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...incoming };
  for (const [key, value] of Object.entries(out)) {
    const previous = existing[key];
    if (value === SECRET_PLACEHOLDER && typeof previous === 'string') {
      out[key] = previous;
      continue;
    }
    if (
      value &&
      previous &&
      typeof value === 'object' &&
      typeof previous === 'object' &&
      !Array.isArray(value) &&
      !Array.isArray(previous)
    ) {
      out[key] = resolveConfigPlaceholders(
        value as Record<string, unknown>,
        previous as Record<string, unknown>
      );
    }
  }
  return out;
}

function withDecryptedConfig(g: GatewayRow): GatewayRow {
  if (!g) return g;
  return { ...g, config: decryptPaymentConfig(g.config) } as Gateway;
}

export class PaymentGatewayService {
  async getAll(): Promise<Gateway[]> {
    const list = await prisma.paymentGateway.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return list
      .filter((g) => isSupportedPaymentGatewayType(g.type))
      .map((g) => withDecryptedConfig(g) as Gateway);
  }

  async getEnabled(): Promise<Gateway[]> {
    const list = await prisma.paymentGateway.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return list
      .filter((g) => isSupportedPaymentGatewayType(g.type))
      .map((g) => withDecryptedConfig(g) as Gateway);
  }

  async getById(id: string) {
    const g = await prisma.paymentGateway.findUnique({
      where: { id },
    });
    return withDecryptedConfig(g);
  }

  async getByType(type: string) {
    const g = await prisma.paymentGateway.findUnique({
      where: { type },
    });
    return withDecryptedConfig(g);
  }

  async create(data: CreatePaymentGatewayDto, updatedBy?: string): Promise<Gateway> {
    if (!isSupportedPaymentGatewayType(data.type)) {
      throw new Error(`Unsupported payment gateway type "${data.type}"`);
    }

    const existing = await prisma.paymentGateway.findUnique({
      where: { type: data.type },
    });
    if (existing) {
      throw new Error(`Payment gateway with type "${data.type}" already exists. Please update the existing one or use a different type.`);
    }

    const created = await prisma.paymentGateway.create({
      data: {
        type: data.type,
        name: data.name,
        isEnabled: data.isEnabled ?? false,
        isTestMode: data.isTestMode ?? true,
        config: encryptPaymentConfig((data.config || {}) as object) as object,
        supportedCountries: data.supportedCountries || [],
        supportedCurrencies: data.supportedCurrencies || [],
        sortOrder: data.sortOrder || 0,
        updatedBy,
      },
    });
    return withDecryptedConfig(created) as Gateway;
  }

  async update(id: string, data: UpdatePaymentGatewayDto, updatedBy?: string): Promise<Gateway> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.isTestMode !== undefined) updateData.isTestMode = data.isTestMode;
    if (data.config !== undefined) {
      const current = await prisma.paymentGateway.findUnique({ where: { id } });
      const currentConfig = current ? decryptPaymentConfig(current.config) : {};
      const resolvedConfig = resolveConfigPlaceholders(
        data.config as Record<string, unknown>,
        currentConfig
      );
      updateData.config = encryptPaymentConfig(resolvedConfig);
    }
    if (data.supportedCountries !== undefined) updateData.supportedCountries = data.supportedCountries;
    if (data.supportedCurrencies !== undefined) updateData.supportedCurrencies = data.supportedCurrencies;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (updatedBy) updateData.updatedBy = updatedBy;

    const updated = await prisma.paymentGateway.update({
      where: { id },
      data: updateData as any,
    });
    return withDecryptedConfig(updated) as Gateway;
  }

  async delete(id: string) {
    return prisma.paymentGateway.delete({
      where: { id },
    });
  }

  async toggleEnabled(id: string, enabled: boolean, updatedBy?: string): Promise<Gateway> {
    const updated = await prisma.paymentGateway.update({
      where: { id },
      data: {
        isEnabled: enabled,
        updatedBy,
      },
    });
    return withDecryptedConfig(updated) as Gateway;
  }

  /**
   * Test connection to payment gateway (basic checks).
   * For API gateways — test request to API; for manual gateways — check field filling.
   */
  async testConnection(type: string, config: PaymentGatewayConfig): Promise<{ success: boolean; message: string }> {
    const t = type?.toUpperCase() || '';

    if (!isSupportedPaymentGatewayType(t)) {
      return { success: false, message: `Unsupported gateway type: ${type}` };
    }

    switch (t) {
      case 'STRIPE':
        return this.testStripeConnection(config);
      case 'YOOKASSA':
        return this.testYooKassaConnection(config);
      case 'BANK_TRANSFER':
        return this.testBankTransferConfig(config);
      case 'CASH_ON_DELIVERY':
      case 'MANAGER_CHAT':
        return { success: true, message: 'Configuration tested (no API for testing)' };
      default:
        return { success: false, message: `Unknown gateway type: ${type}` };
    }
  }

  private async testStripeConnection(config: PaymentGatewayConfig): Promise<{ success: boolean; message: string }> {
    const secretKey = config.secretKey?.toString().trim();
    if (!secretKey) {
      return { success: false, message: 'Secret key not specified' };
    }
    try {
      const stripe = new Stripe(secretKey, { apiVersion: '2025-12-15.clover' });
      await stripe.balance.retrieve();
      return { success: true, message: 'Stripe API: connection successful' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Invalid API Key') || msg.includes('api_key') || msg.includes('401')) {
        return { success: false, message: 'Invalid secret key or key expired' };
      }
      return { success: false, message: `Stripe API: ${msg}` };
    }
  }

  private async testYooKassaConnection(config: PaymentGatewayConfig): Promise<{ success: boolean; message: string }> {
    // shopId, gateId, gate_id — different names for the same identifier in YooKassa
    const shopId = (
      config.shopId ?? (config as Record<string, unknown>).gateId ?? (config as Record<string, unknown>).gate_id
    )?.toString().trim();
    const secretKey = (config.secretKey ?? (config as Record<string, unknown>).secret_key)?.toString().trim();
    if (!shopId || !secretKey) {
      return { success: false, message: 'Shop ID and secret key are required' };
    }
    try {
      const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
      // GET /v3/payments?limit=1 — authorization check (200 or empty list = OK, 401 = invalid data)
      const res = await fetch('https://api.yookassa.ru/v3/payments?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        return { success: true, message: 'YooKassa API: connection successful' };
      }
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        let hint = 'Invalid Shop ID or secret key. ';
        hint += `[Diagnosis: shopId=${shopId.length} chars, secretKey=${secretKey.length} chars] `;
        if (secretKey.length === 0) {
          hint += 'Secret key is empty — when editing the gateway, enter the key again in the field (password is not substituted from saved data). ';
        }
        try {
          const errJson = JSON.parse(text) as { code?: string; description?: string };
          const desc = errJson?.description || errJson?.code || text.slice(0, 100);
          hint += `API response: ${desc}. `;
          if (String(desc).includes('Authentication type is not allowed')) {
            hint += 'Possible account is configured for OAuth (YooKassa for platforms) or keys from the Checkout/widget section. For REST API, you need data from Settings → API keys. Write to support: b2b_support@yoomoney.ru';
          }
        } catch {
          if (text) hint += `Response: ${text.slice(0, 150)}. `;
        }
        return { success: false, message: hint };
      }
      return { success: false, message: `YooKassa API: HTTP ${res.status} — ${text.slice(0, 200)}` };
    } catch (err: any) {
      return { success: false, message: `YooKassa API: ${err?.message || String(err)}` };
    }
  }

  private testBankTransferConfig(config: PaymentGatewayConfig): { success: boolean; message: string } {
    const accountName = config.accountName?.toString().trim();
    const accountNumber = config.accountNumber?.toString().trim();
    const bankName = config.bankName?.toString().trim();
    if (!accountName || !accountNumber || !bankName) {
      return { success: false, message: 'Specify the account name, account number and bank name' };
    }
    return { success: true, message: 'Bank transfer configuration tested' };
  }

  /** Card gateways are filtered by country/currency. Manual methods are always included when enabled. */
  async getForCountryAndCurrency(countryCode: string, currency: string): Promise<Gateway[]> {
    const allGateways = await prisma.paymentGateway.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const cc = (countryCode || '').trim().toUpperCase();
    const cur = (currency || '').trim().toUpperCase();

    return allGateways
      .filter((gateway) => {
        if (!isSupportedPaymentGatewayType(gateway.type)) return false;
        if (isManualPaymentGatewayType(gateway.type)) return true;
        const countrySupported =
          gateway.supportedCountries.length === 0 ||
          gateway.supportedCountries.some((c) => (c || '').toUpperCase() === cc);
        const currencySupported =
          gateway.supportedCurrencies.length === 0 ||
          gateway.supportedCurrencies.some((c) => (c || '').toUpperCase() === cur);
        return countrySupported && currencySupported;
      })
      .map((g) => withDecryptedConfig(g) as Gateway);
  }

  maskGatewaySecrets(gateway: Gateway): Gateway {
    return {
      ...gateway,
      config: maskConfigSecrets((gateway.config || {}) as Record<string, unknown>),
    } as Gateway;
  }

  maskGatewaySecretsList(gateways: Gateway[]): Gateway[] {
    return gateways.map((g) => this.maskGatewaySecrets(g));
  }
}

export const paymentGatewayService = new PaymentGatewayService();
