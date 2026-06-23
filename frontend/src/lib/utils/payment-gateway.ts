import type { PaymentGatewayConfig } from '$lib/api/payment-gateway.api';

function normalizeLanguageCode(languageCode: string | null | undefined): string {
  return typeof languageCode === 'string' ? languageCode.trim().toLowerCase().split('-')[0] : '';
}

export function resolvePaymentInstruction(
  config: PaymentGatewayConfig | null | undefined,
  languageCode?: string | null
): string {
  const lang = normalizeLanguageCode(languageCode);
  const instruction = typeof config?.instruction === 'string' ? config.instruction.trim() : '';
  const instructionEn =
    typeof config?.instructionEn === 'string' ? config.instructionEn.trim() : '';
  const instructionZh =
    typeof config?.instructionZh === 'string' ? config.instructionZh.trim() : '';

  if (lang === 'zh' && instructionZh) return instructionZh;
  if (lang === 'en' && instructionEn) return instructionEn;
  if (instruction) return instruction;
  if (instructionEn) return instructionEn;
  if (instructionZh) return instructionZh;
  return '';
}
