import type { Order } from '$lib/api/customer.api';
import type { PaymentGatewayConfig } from '$lib/api/payment-gateway.api';
import { i18nStore } from '$lib/stores/i18n.store';
import { formatOrderAmount } from '$lib/utils/price.utils';
import { tLang } from '$lib/utils/i18n';
import { get } from 'svelte/store';

export type ManagerChatTemplateChannel = 'wechat' | 'max';
export type ManagerChatChannel = 'telegram' | 'whatsapp' | ManagerChatTemplateChannel;

function sanitizeTelegramUsername(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/^@+/, '') : '';
}

function sanitizeWhatsappNumber(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/[^\d]/g, '') : '';
}

function sanitizeManagerLink(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveManagerChatLanguage(languageCode?: string): string {
  const normalized =
    typeof languageCode === 'string' ? languageCode.trim().toLowerCase().split('-')[0] : '';
  if (normalized) return normalized;
  if (typeof window !== 'undefined') {
    return get(i18nStore);
  }
  return 'en';
}

function translateManagerChatMessage(
  key: string,
  languageCode: string,
  params?: Record<string, string | number>
): string {
  return tLang(key, languageCode, params);
}

function buildOrderUrl(orderId: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/account/orders/${orderId}`;
}

function buildTelegramDraftText(order: Order, languageCode: string): string {
  return buildOrderMessage(order, languageCode);
}

function buildOrderMessage(order: Order, languageCode?: string): string {
  const lang = resolveManagerChatLanguage(languageCode);
  const itemLines = order.items
    .map((item) => {
      const sizePart = item.size
        ? translateManagerChatMessage('managerChat.message.sizeSuffix', lang, { size: item.size })
        : '';
      return translateManagerChatMessage('managerChat.message.itemLine', lang, {
        name: item.product.name,
        quantity: item.quantity,
        sizePart,
      });
    })
    .join('\n');

  const customerName = [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const addressParts = [
    order.shippingAddress?.address,
    order.shippingAddress?.city,
    order.shippingAddress?.country,
    order.shippingAddress?.postalCode,
  ].filter(Boolean);

  return [
    translateManagerChatMessage('managerChat.message.greeting', lang, {
      orderNumber: order.orderNumber,
    }),
    '',
    translateManagerChatMessage('managerChat.message.order', lang, {
      orderNumber: order.orderNumber,
    }),
    translateManagerChatMessage('managerChat.message.total', lang, {
      total: formatOrderAmount(order.total || 0, order),
    }),
    customerName
      ? translateManagerChatMessage('managerChat.message.customer', lang, { name: customerName })
      : '',
    order.shippingAddress?.phone
      ? translateManagerChatMessage('managerChat.message.phone', lang, {
          phone: order.shippingAddress.phone,
        })
      : '',
    addressParts.length > 0
      ? translateManagerChatMessage('managerChat.message.shipping', lang, {
          address: addressParts.join(', '),
        })
      : '',
    order.notes
      ? translateManagerChatMessage('managerChat.message.notes', lang, { notes: order.notes })
      : '',
    '',
    translateManagerChatMessage('managerChat.message.items', lang),
    itemLines || '-',
    '',
    translateManagerChatMessage('managerChat.message.orderPage', lang, {
      url: buildOrderUrl(order.id),
    }),
  ]
    .filter(Boolean)
    .join('\n');
}

export function hasManagerChatContact(
  config: PaymentGatewayConfig | null | undefined,
  channel: ManagerChatChannel
): boolean {
  if (channel === 'telegram') {
    return sanitizeTelegramUsername(config?.telegramUsername) !== '';
  }
  if (channel === 'whatsapp') {
    return sanitizeWhatsappNumber(config?.whatsappNumber) !== '';
  }
  if (channel === 'wechat') {
    return sanitizeManagerLink(config?.wechatLink) !== '';
  }
  return sanitizeManagerLink(config?.maxLink) !== '';
}

function applyMessageTemplate(link: string, message: string): string {
  if (link.includes('{encodedMessage}')) {
    return link.replaceAll('{encodedMessage}', message);
  }

  if (link.includes('{message}')) {
    return link.replaceAll('{message}', message);
  }

  return link;
}

export function buildManagerChatLink(
  config: PaymentGatewayConfig | null | undefined,
  channel: ManagerChatChannel,
  order: Order,
  languageCode?: string
): string | null {
  const lang = resolveManagerChatLanguage(languageCode);
  if (channel === 'telegram') {
    const username = sanitizeTelegramUsername(config?.telegramUsername);
    if (!username) return null;

    const url = new URL(`https://t.me/${username}/`);
    url.searchParams.set('text', buildTelegramDraftText(order, lang));
    return url.toString();
  }

  if (channel === 'whatsapp') {
    const message = encodeURIComponent(buildOrderMessage(order, lang));
    const whatsappNumber = sanitizeWhatsappNumber(config?.whatsappNumber);
    return whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${message}` : null;
  }

  if (channel === 'wechat') {
    const message = encodeURIComponent(buildOrderMessage(order, lang));
    const wechatLink = sanitizeManagerLink(config?.wechatLink);
    return wechatLink ? applyMessageTemplate(wechatLink, message) : null;
  }

  const message = encodeURIComponent(buildOrderMessage(order, lang));
  const maxLink = sanitizeManagerLink(config?.maxLink);
  return maxLink ? applyMessageTemplate(maxLink, message) : null;
}

export function buildManagerChatAppLink(
  config: PaymentGatewayConfig | null | undefined,
  channel: ManagerChatChannel,
  order: Order,
  languageCode?: string
): string | null {
  if (channel !== 'telegram') return buildManagerChatLink(config, channel, order, languageCode);

  const lang = resolveManagerChatLanguage(languageCode);
  const username = sanitizeTelegramUsername(config?.telegramUsername);
  if (!username) return null;

  const params = new URLSearchParams();
  params.set('domain', username);
  params.set('text', buildTelegramDraftText(order, lang));
  return `tg://resolve?${params.toString()}`;
}
