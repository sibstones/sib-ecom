import prisma from '../config/database';
import { sanitizeHtmlContent } from '../utils/sanitize';

export type EmailTemplateType =
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'
  | 'WELCOME'
  | 'ORDER_CONFIRMATION'
  | 'SHIPPING'
  | 'DELIVERY'
  | 'PAYMENT_REQUEST'
  | 'PAYMENT_CONFIRMED'
  | 'RETURN_NOTIFICATION'
  | 'PROMOTIONAL';

/** Per-locale content (ISO 639-1: en, ru, de, ...) */
export interface EmailTemplateTranslation {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailTemplateData {
  type: EmailTemplateType;
  subject: string;
  htmlContent: string;
  textContent?: string;
  enabled?: boolean;
  description?: string;
  variables?: Record<string, string>; // Description of available variables
  /** Per-locale overrides for subject/htmlContent/textContent */
  translations?: Record<string, EmailTemplateTranslation>;
}

export interface EmailTemplateVariables {
  [key: string]: string | number | undefined;
}

export class EmailTemplateService {
  // Default templates with variables
  private readonly defaultTemplates: Record<EmailTemplateType, EmailTemplateData> = {
    PASSWORD_RESET: {
      type: 'PASSWORD_RESET',
      subject: '{{passwordResetSubject}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{passwordResetTitle}}</h2>
        <p>{{passwordResetGreetingPrefix}}{{#userName}} {{userName}}{{/userName}},</p>
        <p>{{passwordResetIntro}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{resetLink}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{passwordResetButtonLabel}}
              </a>
            </td>
          </tr>
        </table>
        <p style="color: {{secondaryColor}}; font-size: 14px;">
          {{passwordResetExpiryNote}}
        </p>
        <p style="color: {{secondaryColor}}; font-size: 14px;">
          {{passwordResetLinkFallbackPrefix}}<br>
          <a href="{{resetLink}}" style="color: {{primaryColor}}; word-break: break-all;">{{resetLink}}</a>
        </p>
      `,
      textContent: `{{passwordResetTitle}}\n\n{{passwordResetGreetingPrefix}}{{#userName}} {{userName}}{{/userName}},\n\n{{passwordResetTextIntro}}\n{{resetLink}}\n\n{{passwordResetTextIgnoreNote}}`,
      description: 'Sent when a user requests a password reset',
      variables: {
        userName: 'User name (optional)',
        resetToken: 'Password reset token',
        resetLink: 'Full password reset URL',
        passwordResetSubject: 'Localized password reset subject',
        passwordResetTitle: 'Localized password reset title',
        passwordResetGreetingPrefix: 'Localized greeting prefix',
        passwordResetIntro: 'Localized intro text',
        passwordResetButtonLabel: 'Localized reset button label',
        passwordResetExpiryNote: 'Localized expiry note',
        passwordResetLinkFallbackPrefix: 'Localized link fallback prefix',
        passwordResetTextIntro: 'Localized plain-text intro',
        passwordResetTextIgnoreNote: 'Localized plain-text ignore note',
      },
    },
    EMAIL_VERIFICATION: {
      type: 'EMAIL_VERIFICATION',
      subject: '{{emailVerificationSubject}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{emailVerificationTitle}}</h2>
        <p>{{emailVerificationGreetingPrefix}}{{#userName}} {{userName}}{{/userName}},</p>
        <p>{{emailVerificationIntro}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{verifyLink}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{emailVerificationButtonLabel}}
              </a>
            </td>
          </tr>
        </table>
        <p style="color: {{secondaryColor}}; font-size: 14px;">
          {{emailVerificationExpiryNote}}
        </p>
        <p style="color: {{secondaryColor}}; font-size: 14px;">
          {{emailVerificationLinkFallbackPrefix}}<br>
          <a href="{{verifyLink}}" style="color: {{primaryColor}}; word-break: break-all;">{{verifyLink}}</a>
        </p>
      `,
      textContent: `{{emailVerificationTitle}}\n\n{{emailVerificationGreetingPrefix}}{{#userName}} {{userName}}{{/userName}},\n\n{{emailVerificationTextIntro}}\n{{verifyLink}}\n\n{{emailVerificationTextExpiryNote}}`,
      description: 'Sent after registration to confirm email address',
      variables: {
        userName: 'User name (optional)',
        verifyLink: 'Full email verification URL',
        emailVerificationSubject: 'Localized email verification subject',
        emailVerificationTitle: 'Localized email verification title',
        emailVerificationGreetingPrefix: 'Localized greeting prefix',
        emailVerificationIntro: 'Localized intro text',
        emailVerificationButtonLabel: 'Localized verification button label',
        emailVerificationExpiryNote: 'Localized expiry note',
        emailVerificationLinkFallbackPrefix: 'Localized link fallback prefix',
        emailVerificationTextIntro: 'Localized plain-text intro',
        emailVerificationTextExpiryNote: 'Localized plain-text expiry note',
      },
    },
    WELCOME: {
      type: 'WELCOME',
      subject: '{{welcomeSubject}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{welcomeTitle}}</h2>
        <p>{{welcomeGreetingPrefix}} {{userName}},</p>
        <p>{{welcomeIntro}}</p>
        <p>{{welcomeShopIntro}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{shopUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{welcomeButtonLabel}}
              </a>
            </td>
          </tr>
        </table>
        <p>{{welcomeSupportNote}}</p>
      `,
      textContent: `{{welcomeTitle}}\n\n{{welcomeGreetingPrefix}} {{userName}},\n\n{{welcomeTextIntro}}\n{{welcomeTextShopPrefix}}: {{shopUrl}}`,
      description: 'Sent to new users after registration',
      variables: {
        userName: 'User name',
        shopUrl: 'URL to shop page',
        welcomeSubject: 'Localized welcome email subject',
        welcomeTitle: 'Localized welcome title',
        welcomeGreetingPrefix: 'Localized greeting prefix',
        welcomeIntro: 'Localized welcome intro',
        welcomeShopIntro: 'Localized shopping intro',
        welcomeButtonLabel: 'Localized welcome button label',
        welcomeSupportNote: 'Localized support note',
        welcomeTextIntro: 'Localized plain-text intro',
        welcomeTextShopPrefix: 'Localized plain-text shop prefix',
      },
    },
    ORDER_CONFIRMATION: {
      type: 'ORDER_CONFIRMATION',
      subject: '{{orderConfirmationSubjectPrefix}} - {{orderNumber}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{orderConfirmationTitle}}</h2>
        <p>{{orderConfirmationThankYou}}</p>
        <p><strong>{{orderNumberLabel}}:</strong> {{orderNumber}}</p>
        {{#orderItems}}
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">{{itemLabel}}</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">{{priceLabel}}</th>
            </tr>
          </thead>
          <tbody>
            {{#items}}
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">{{name}}{{#size}} ({{sizeLabel}}: {{size}}){{/size}} x {{quantity}}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">\${{price}}</td>
            </tr>
            {{/items}}
          </tbody>
        </table>
        {{/orderItems}}
        {{#orderTotal}}
        <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">{{totalLabel}}: \${{orderTotal}}</p>
        {{/orderTotal}}
        {{#priceOnRequestTotalsNote}}
        <p style="margin-top: 20px; color: {{secondaryColor}}; line-height: 1.6;">{{priceOnRequestTotalsNote}}</p>
        {{/priceOnRequestTotalsNote}}
        <p>{{orderShippedFollowUp}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{orderUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{viewOrderLabel}}
              </a>
            </td>
          </tr>
        </table>
      `,
      textContent: `{{orderConfirmationTitle}}\n\n{{orderNumberLabel}}: {{orderNumber}}\n\n{{orderConfirmationThankYou}}\n{{#priceOnRequestTotalsNote}}{{priceOnRequestTotalsNote}}\n\n{{/priceOnRequestTotalsNote}}{{textViewOrder}}: {{orderUrl}}`,
      description: 'Sent when an order is placed',
      variables: {
        orderNumber: 'Order number',
        orderId: 'Order ID',
        orderUrl: 'URL to view order',
        orderTotal: 'Total order amount',
        orderItems: 'Order items array (JSON)',
        orderConfirmationSubjectPrefix: 'Localized email subject prefix',
        orderConfirmationTitle: 'Localized email title',
        orderConfirmationThankYou: 'Localized thank-you text',
        orderNumberLabel: 'Localized order number label',
        itemLabel: 'Localized item column label',
        priceLabel: 'Localized price column label',
        sizeLabel: 'Localized size label',
        totalLabel: 'Localized total label',
        orderShippedFollowUp: 'Localized follow-up message after order creation',
        viewOrderLabel: 'Localized button label',
        priceOnRequestTotalsNote: 'Optional localized note for price on request totals',
        textViewOrder: 'Localized plain-text order link label',
      },
    },
    SHIPPING: {
      type: 'SHIPPING',
      subject: '{{shippingSubjectPrefix}} {{orderNumber}}!',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{shippingTitle}}</h2>
        <p>{{shippingIntro}}</p>
        {{#trackingNumber}}
        <p><strong>{{shippingTrackingNumberLabel}}:</strong> {{trackingNumber}}{{#carrier}} ({{carrier}}){{/carrier}}</p>
        {{/trackingNumber}}
        <p>{{shippingTrackOrderIntro}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{orderUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{shippingButtonLabel}}
              </a>
            </td>
          </tr>
        </table>
        <p>{{shippingFollowUp}}</p>
      `,
      textContent: `{{shippingTitle}}\n\n{{shippingOrderNumberLabel}}: {{orderNumber}}{{#trackingNumber}}\n{{shippingTrackingPrefix}}: {{trackingNumber}}{{/trackingNumber}}\n\n{{shippingTextTrackPrefix}}: {{orderUrl}}`,
      description: 'Sent when an order is shipped',
      variables: {
        orderNumber: 'Order number',
        orderId: 'Order ID',
        orderUrl: 'URL to track order',
        trackingNumber: 'Tracking number (optional)',
        carrier: 'Carrier name (optional)',
        shippingSubjectPrefix: 'Localized shipping email subject prefix',
        shippingTitle: 'Localized shipping title',
        shippingIntro: 'Localized shipping intro',
        shippingTrackingNumberLabel: 'Localized tracking number label',
        shippingTrackOrderIntro: 'Localized tracking intro',
        shippingButtonLabel: 'Localized tracking button label',
        shippingFollowUp: 'Localized shipping follow up',
        shippingOrderNumberLabel: 'Localized order number label',
        shippingTrackingPrefix: 'Localized plain-text tracking prefix',
        shippingTextTrackPrefix: 'Localized plain-text track order prefix',
      },
    },
    DELIVERY: {
      type: 'DELIVERY',
      subject: '{{deliverySubjectPrefix}} {{orderNumber}}!',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{deliveryTitle}}</h2>
        <p>{{deliveryIntro}}</p>
        <p>{{deliverySupportNote}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{orderUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{deliveryButtonLabel}}
              </a>
            </td>
          </tr>
        </table>
        <p>{{deliveryThanksNote}}</p>
      `,
      textContent: `{{deliveryTitle}}\n\n{{deliveryOrderNumberLabel}}: {{orderNumber}}\n\n{{deliveryTextViewOrderPrefix}}: {{orderUrl}}`,
      description: 'Sent when an order is delivered',
      variables: {
        orderNumber: 'Order number',
        orderId: 'Order ID',
        orderUrl: 'URL to view order',
        deliverySubjectPrefix: 'Localized delivery email subject prefix',
        deliveryTitle: 'Localized delivery title',
        deliveryIntro: 'Localized delivery intro',
        deliverySupportNote: 'Localized delivery support note',
        deliveryButtonLabel: 'Localized delivery button label',
        deliveryThanksNote: 'Localized delivery thanks note',
        deliveryOrderNumberLabel: 'Localized order number label',
        deliveryTextViewOrderPrefix: 'Localized plain-text view order prefix',
      },
    },
    PAYMENT_REQUEST: {
      type: 'PAYMENT_REQUEST',
      subject: '{{paymentRequestSubjectPrefix}} {{orderNumber}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{paymentRequestTitle}}</h2>
        <p>{{paymentRequestIntro}}</p>
        <p>{{paymentRequestInstructions}}</p>
        {{#bankDetails}}
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin: 20px 0;">
          {{#accountNumber}}<p><strong>{{paymentRequestAccountNumberLabel}}:</strong> {{accountNumber}}</p>{{/accountNumber}}
          {{#bankName}}<p><strong>{{paymentRequestBankLabel}}:</strong> {{bankName}}</p>{{/bankName}}
          {{#swift}}<p><strong>{{paymentRequestSwiftLabel}}:</strong> {{swift}}</p>{{/swift}}
        </div>
        {{/bankDetails}}
        <p>{{paymentRequestReceiptNote}}</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{orderUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{paymentRequestButtonLabel}}
              </a>
            </td>
          </tr>
        </table>
      `,
      textContent: `{{paymentRequestTitle}}\n\n{{paymentRequestOrderNumberLabel}}: {{orderNumber}}\n\n{{paymentRequestTextIntro}} {{paymentRequestTextViewOrderPrefix}}: {{orderUrl}}`,
      description: 'Sent for orders with bank transfer payment',
      variables: {
        orderNumber: 'Order number',
        orderId: 'Order ID',
        orderUrl: 'URL to view order',
        bankDetails: 'Bank details object (optional)',
        paymentRequestSubjectPrefix: 'Localized payment request subject prefix',
        paymentRequestTitle: 'Localized payment request title',
        paymentRequestIntro: 'Localized payment request intro',
        paymentRequestInstructions: 'Localized payment instructions',
        paymentRequestAccountNumberLabel: 'Localized account number label',
        paymentRequestBankLabel: 'Localized bank label',
        paymentRequestSwiftLabel: 'Localized swift label',
        paymentRequestReceiptNote: 'Localized receipt note',
        paymentRequestButtonLabel: 'Localized payment request button label',
        paymentRequestOrderNumberLabel: 'Localized order number label',
        paymentRequestTextIntro: 'Localized plain-text intro',
        paymentRequestTextViewOrderPrefix: 'Localized plain-text view order prefix',
      },
    },
    PAYMENT_CONFIRMED: {
      type: 'PAYMENT_CONFIRMED',
      subject: 'Payment Confirmed - Order {{orderNumber}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">Payment Confirmed</h2>
        <p>Great news! We've received your payment for order {{orderNumber}}.</p>
        <p>We're now processing your order and will notify you when it ships.</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{orderUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Order
              </a>
            </td>
          </tr>
        </table>
      `,
      textContent: `Payment Confirmed\n\nOrder Number: {{orderNumber}}\n\nWe've received your payment. View order: {{orderUrl}}`,
      description: 'Sent when payment is confirmed',
      variables: {
        orderNumber: 'Order number',
        orderId: 'Order ID',
        orderUrl: 'URL to view order',
      },
    },
    RETURN_NOTIFICATION: {
      type: 'RETURN_NOTIFICATION',
      subject: 'Return Status Updated - Order {{orderNumber}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">Return Status Updated</h2>
        <p>Your return request for order <strong>{{orderNumber}}</strong> has been processed.</p>
        <p><strong>Status:</strong> {{status}}</p>
        {{#pickupInfo}}
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">Return Information</h3>
          {{#pickupMethod}}<p><strong>Return Method:</strong> {{pickupMethod}}</p>{{/pickupMethod}}
          {{#pickupAddress}}<p><strong>Return Address:</strong> {{pickupAddress}}</p>{{/pickupAddress}}
          {{#pickupDate}}<p><strong>Return Date:</strong> {{pickupDate}}</p>{{/pickupDate}}
          {{#pickupNotes}}<p><strong>Instructions:</strong> {{pickupNotes}}</p>{{/pickupNotes}}
        </div>
        {{/pickupInfo}}
        {{#refundInfo}}
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #22c55e;">
          <h3 style="color: #15803d; margin-top: 0;">Refund Information</h3>
          {{#refundMethod}}<p><strong>Refund Method:</strong> {{refundMethod}}</p>{{/refundMethod}}
          {{#refundAmount}}<p><strong>Refund Amount:</strong> \${{refundAmount}}</p>{{/refundAmount}}
        </div>
        {{/refundInfo}}
        <p>You can view return details in your account.</p>
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{orderUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Return
              </a>
            </td>
          </tr>
        </table>
      `,
      textContent: `Return Status Updated\n\nOrder: {{orderNumber}}\nStatus: {{status}}\n\nView: {{orderUrl}}`,
      description: 'Sent when return request status is updated',
      variables: {
        orderNumber: 'Order number',
        status: 'Return status',
        orderUrl: 'URL to view order',
        pickupInfo: 'Pickup information object (optional)',
        refundInfo: 'Refund information object (optional)',
      },
    },
    PROMOTIONAL: {
      type: 'PROMOTIONAL',
      subject: '{{subject}}',
      htmlContent: `
        <h2 style="color: {{primaryColor}}; margin-top: 0;">{{subject}}</h2>
        {{content}}
        {{#ctaUrl}}
        <table role="presentation" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="{{ctaUrl}}" style="display: inline-block; padding: 12px 30px; background-color: {{buttonColor}}; color: {{buttonTextColor}}; text-decoration: none; border-radius: 4px; font-weight: bold;">
                {{ctaText}}
              </a>
            </td>
          </tr>
        </table>
        {{/ctaUrl}}
      `,
      textContent: `{{subject}}\n\n{{content}}{{#ctaUrl}}\n\n{{ctaText}}: {{ctaUrl}}{{/ctaUrl}}`,
      description: 'Custom promotional emails',
      variables: {
        subject: 'Email subject',
        content: 'Email content (HTML)',
        ctaText: 'Call-to-action button text (optional)',
        ctaUrl: 'Call-to-action URL (optional)',
      },
    },
  };

  async getAllTemplates(): Promise<EmailTemplateData[]> {
    try {
      const templates = await prisma.emailTemplate.findMany({
        orderBy: { type: 'asc' },
      });

      // Merge with defaults for missing templates; include translations for admin editor
      const result: EmailTemplateData[] = [];
      for (const type of Object.keys(this.defaultTemplates) as EmailTemplateType[]) {
        const dbTemplate = templates.find((t) => t.type === type);
        if (dbTemplate) {
          result.push({
            type: dbTemplate.type as EmailTemplateType,
            subject: dbTemplate.subject,
            htmlContent: dbTemplate.htmlContent,
            textContent: dbTemplate.textContent || undefined,
            enabled: dbTemplate.enabled,
            description: dbTemplate.description || undefined,
            variables: (dbTemplate.variables as Record<string, string>) || undefined,
            translations: (dbTemplate.translations as unknown as Record<string, EmailTemplateTranslation>) || undefined,
          });
        } else {
          result.push(this.defaultTemplates[type]);
        }
      }

      return result;
    } catch (error) {
      console.error('Error loading email templates from database:', error);
      // Return default templates if database query fails
      return Object.values(this.defaultTemplates);
    }
  }

  /**
   * Get template for admin (all content + translations) or for rendering.
   * If locale is provided and translations[locale] exists, returned subject/htmlContent/textContent are from that locale; otherwise default.
   */
  async getTemplate(type: EmailTemplateType, locale?: string): Promise<EmailTemplateData | null> {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { type },
      });

      if (template) {
        const translations = (template.translations as unknown as Record<string, EmailTemplateTranslation>) || undefined;
        let subject = template.subject;
        let htmlContent = template.htmlContent;
        let textContent = template.textContent ?? undefined;
        if (locale && translations?.[locale]) {
          subject = translations[locale].subject;
          htmlContent = translations[locale].htmlContent;
          textContent = translations[locale].textContent ?? textContent;
        }
        return {
          type: template.type as EmailTemplateType,
          subject,
          htmlContent,
          textContent,
          enabled: template.enabled,
          description: template.description || undefined,
          variables: (template.variables as Record<string, string>) || undefined,
          translations,
        };
      }

      return this.defaultTemplates[type] || null;
    } catch (error) {
      console.error(`Error loading email template ${type} from database:`, error);
      return this.defaultTemplates[type] || null;
    }
  }

  async createOrUpdateTemplate(
    data: EmailTemplateData,
    updatedBy?: string
  ): Promise<EmailTemplateData> {
    const safeHtml = sanitizeHtmlContent(data.htmlContent) ?? data.htmlContent;
    const safeTranslations = data.translations
      ? Object.fromEntries(
          Object.entries(data.translations).map(([code, t]) => [
            code,
            {
              subject: t.subject,
              htmlContent: sanitizeHtmlContent(t.htmlContent) ?? t.htmlContent,
              textContent: t.textContent ?? undefined,
            },
          ])
        )
      : undefined;
    const template = await prisma.emailTemplate.upsert({
      where: { type: data.type },
      update: {
        subject: data.subject,
        htmlContent: safeHtml,
        textContent: data.textContent || null,
        enabled: data.enabled !== undefined ? data.enabled : true,
        description: data.description || null,
        variables: data.variables ?? undefined,
        translations: safeTranslations ?? undefined,
        updatedBy,
        updatedAt: new Date(),
      },
      create: {
        type: data.type,
        subject: data.subject,
        htmlContent: safeHtml,
        textContent: data.textContent || null,
        enabled: data.enabled !== undefined ? data.enabled : true,
        description: data.description || null,
        variables: data.variables ?? undefined,
        translations: safeTranslations ?? undefined,
        updatedBy,
      },
    });

    return {
      type: template.type as EmailTemplateType,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent || undefined,
      enabled: template.enabled,
      description: template.description || undefined,
      variables: (template.variables as Record<string, string>) || undefined,
      translations: (template.translations as unknown as Record<string, EmailTemplateTranslation>) || undefined,
    };
  }

  async deleteTemplate(type: EmailTemplateType): Promise<void> {
    await prisma.emailTemplate.delete({
      where: { type },
    });
  }

  // Simple template variable replacement (supports {{variable}} and {{#variable}}...{{/variable}} for conditionals)
  private replaceVariables(template: string, variables: EmailTemplateVariables): string {
    let result = template;

    // Replace simple variables {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, String(value));
      }
    }

    // Handle conditional blocks {{#variable}}...{{/variable}}
    const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    result = result.replace(conditionalRegex, (match, key, content) => {
      const value = variables[key];
      if (value !== undefined && value !== null && value !== '') {
        // Recursively replace variables in the content
        return this.replaceVariables(content, variables);
      }
      return '';
    });

    return result;
  }

  /**
   * Render template with variable substitution.
   * If locale is provided and template has translations[locale], that content is used; otherwise default.
   */
  async renderTemplate(
    type: EmailTemplateType,
    variables: EmailTemplateVariables,
    locale?: string
  ): Promise<{ subject: string; html: string; text?: string } | null> {
    try {
      const template = await this.getTemplate(type, locale);
      if (!template || !template.enabled) {
        return null;
      }

      const subject = this.replaceVariables(template.subject, variables);
      const html = this.replaceVariables(template.htmlContent, variables);
      const text = template.textContent
        ? this.replaceVariables(template.textContent, variables)
        : undefined;

      return { subject, html, text };
    } catch (error) {
      console.error(`Error rendering email template ${type}:`, error);
      return null;
    }
  }
}

export const emailTemplateService = new EmailTemplateService();
