export interface OrderConfirmationEmailCopy {
  subjectPrefix: string;
  title: string;
  thankYou: string;
  orderNumberLabel: string;
  itemLabel: string;
  priceLabel: string;
  sizeLabel: string;
  totalLabel: string;
  shippedFollowUp: string;
  viewOrderLabel: string;
  priceOnRequestLabel: string;
  priceOnRequestTotalsNote: string;
  textIntro: string;
  textViewOrder: string;
}

export interface PasswordResetEmailCopy {
  subject: string;
  title: string;
  greetingPrefix: string;
  intro: string;
  buttonLabel: string;
  expiryNote: string;
  linkFallbackPrefix: string;
  textIntro: string;
  textIgnoreNote: string;
}

export interface EmailVerificationEmailCopy {
  subject: string;
  title: string;
  greetingPrefix: string;
  intro: string;
  buttonLabel: string;
  expiryNote: string;
  linkFallbackPrefix: string;
  textIntro: string;
  textExpiryNote: string;
}

export interface WelcomeEmailCopy {
  subject: string;
  title: string;
  greetingPrefix: string;
  intro: string;
  shopIntro: string;
  buttonLabel: string;
  supportNote: string;
  textIntro: string;
  textShopPrefix: string;
}

export interface ShippingEmailCopy {
  subjectPrefix: string;
  title: string;
  intro: string;
  trackingNumberLabel: string;
  trackingPrefix: string;
  trackOrderIntro: string;
  buttonLabel: string;
  followUp: string;
  orderNumberLabel: string;
  textTrackPrefix: string;
}

export interface DeliveryEmailCopy {
  subjectPrefix: string;
  title: string;
  intro: string;
  supportNote: string;
  buttonLabel: string;
  thanksNote: string;
  orderNumberLabel: string;
  textViewOrderPrefix: string;
}

export interface PaymentRequestEmailCopy {
  subjectPrefix: string;
  title: string;
  intro: string;
  paymentInstructions: string;
  accountNumberLabel: string;
  bankLabel: string;
  swiftLabel: string;
  receiptNote: string;
  buttonLabel: string;
  orderNumberLabel: string;
  textIntro: string;
  textViewOrderPrefix: string;
}

const orderConfirmationCopyByLocale: Record<string, OrderConfirmationEmailCopy> = {
  en: {
    subjectPrefix: 'Order Confirmation',
    title: 'Order Confirmation',
    thankYou: 'Thank you for your order!',
    orderNumberLabel: 'Order Number',
    itemLabel: 'Item',
    priceLabel: 'Price',
    sizeLabel: 'Size',
    totalLabel: 'Total',
    shippedFollowUp: "We'll send you another email when your order ships.",
    viewOrderLabel: 'View Order',
    priceOnRequestLabel: 'Price on Request',
    priceOnRequestTotalsNote:
      'Totals include only items with known prices. Price on Request items will be priced by an admin after the order is placed.',
    textIntro: 'Thank you for your order!',
    textViewOrder: 'View your order at',
  },
  ru: {
    subjectPrefix: 'Подтверждение заказа',
    title: 'Подтверждение заказа',
    thankYou: 'Спасибо за ваш заказ!',
    orderNumberLabel: 'Номер заказа',
    itemLabel: 'Товар',
    priceLabel: 'Цена',
    sizeLabel: 'Размер',
    totalLabel: 'Итого',
    shippedFollowUp: 'Мы отправим вам ещё одно письмо, когда заказ будет отправлен.',
    viewOrderLabel: 'Открыть заказ',
    priceOnRequestLabel: 'Цена по запросу',
    priceOnRequestTotalsNote:
      'В итог включены только товары с известной ценой. Позиции «Цена по запросу» будут оценены администратором после оформления заказа.',
    textIntro: 'Спасибо за ваш заказ!',
    textViewOrder: 'Откройте заказ по ссылке',
  },
};

const passwordResetCopyByLocale: Record<string, PasswordResetEmailCopy> = {
  en: {
    subject: 'Reset Your Password',
    title: 'Password Reset Request',
    greetingPrefix: 'Hello',
    intro: 'We received a request to reset your password. Click the button below to create a new password:',
    buttonLabel: 'Reset Password',
    expiryNote: "If you didn't request this, please ignore this email. This link will expire in 1 hour.",
    linkFallbackPrefix: 'Or copy and paste this link into your browser:',
    textIntro: 'We received a request to reset your password. Click the link below:',
    textIgnoreNote: "If you didn't request this, please ignore this email.",
  },
  ru: {
    subject: 'Сброс пароля',
    title: 'Запрос на сброс пароля',
    greetingPrefix: 'Здравствуйте',
    intro: 'Мы получили запрос на сброс пароля. Нажмите кнопку ниже, чтобы создать новый пароль:',
    buttonLabel: 'Сбросить пароль',
    expiryNote: 'Если это были не вы, просто проигнорируйте это письмо. Ссылка действует 1 час.',
    linkFallbackPrefix: 'Или скопируйте и вставьте эту ссылку в браузер:',
    textIntro: 'Мы получили запрос на сброс пароля. Перейдите по ссылке ниже:',
    textIgnoreNote: 'Если это были не вы, просто проигнорируйте это письмо.',
  },
};

const emailVerificationCopyByLocale: Record<string, EmailVerificationEmailCopy> = {
  en: {
    subject: 'Verify your email address',
    title: 'Verify your email',
    greetingPrefix: 'Hello',
    intro: 'Please confirm your email address by clicking the button below:',
    buttonLabel: 'Verify email',
    expiryNote: 'This link expires in 24 hours. If you did not create an account, you can ignore this message.',
    linkFallbackPrefix: 'Or copy and paste this link into your browser:',
    textIntro: 'Confirm your address:',
    textExpiryNote: 'Link expires in 24 hours.',
  },
  ru: {
    subject: 'Подтвердите email адрес',
    title: 'Подтвердите email',
    greetingPrefix: 'Здравствуйте',
    intro: 'Пожалуйста, подтвердите ваш email адрес, нажав на кнопку ниже:',
    buttonLabel: 'Подтвердить email',
    expiryNote: 'Ссылка действует 24 часа. Если вы не создавали аккаунт, просто проигнорируйте это письмо.',
    linkFallbackPrefix: 'Или скопируйте и вставьте эту ссылку в браузер:',
    textIntro: 'Подтвердите ваш адрес:',
    textExpiryNote: 'Ссылка действует 24 часа.',
  },
};

const welcomeCopyByLocale: Record<string, WelcomeEmailCopy> = {
  en: {
    subject: 'Welcome to Fashion Store!',
    title: 'Welcome to Fashion Store!',
    greetingPrefix: 'Hello',
    intro: "Thank you for joining us! We're excited to have you as part of our community.",
    shopIntro: 'Start shopping and discover our latest fashion collections:',
    buttonLabel: 'Start Shopping',
    supportNote: 'If you have any questions, feel free to contact our support team.',
    textIntro: "Thank you for joining us!",
    textShopPrefix: 'Start shopping at',
  },
  ru: {
    subject: 'Добро пожаловать в Fashion Store!',
    title: 'Добро пожаловать в Fashion Store!',
    greetingPrefix: 'Здравствуйте',
    intro: 'Спасибо, что присоединились к нам! Мы рады видеть вас в нашем сообществе.',
    shopIntro: 'Начните покупки и откройте для себя наши новые коллекции:',
    buttonLabel: 'Перейти к покупкам',
    supportNote: 'Если у вас есть вопросы, свяжитесь с нашей службой поддержки.',
    textIntro: 'Спасибо, что присоединились к нам!',
    textShopPrefix: 'Начните покупки здесь',
  },
};

const shippingCopyByLocale: Record<string, ShippingEmailCopy> = {
  en: {
    subjectPrefix: 'Your Order Has Shipped',
    title: 'Your Order Has Shipped!',
    intro: 'Great news! Your order {{orderNumber}} has been shipped.',
    trackingNumberLabel: 'Tracking Number',
    trackingPrefix: 'Tracking',
    trackOrderIntro: 'You can track your order using the link below:',
    buttonLabel: 'Track Order',
    followUp: "We'll notify you when your package arrives.",
    orderNumberLabel: 'Order Number',
    textTrackPrefix: 'Track your order',
  },
  ru: {
    subjectPrefix: 'Ваш заказ отправлен',
    title: 'Ваш заказ отправлен!',
    intro: 'Отличные новости! Ваш заказ {{orderNumber}} был отправлен.',
    trackingNumberLabel: 'Трек-номер',
    trackingPrefix: 'Отслеживание',
    trackOrderIntro: 'Вы можете отслеживать заказ по ссылке ниже:',
    buttonLabel: 'Отследить заказ',
    followUp: 'Мы сообщим вам, когда посылка прибудет.',
    orderNumberLabel: 'Номер заказа',
    textTrackPrefix: 'Отследить заказ',
  },
};

const deliveryCopyByLocale: Record<string, DeliveryEmailCopy> = {
  en: {
    subjectPrefix: 'Your Order Has Been Delivered',
    title: 'Your Order Has Been Delivered!',
    intro: 'Great news! Your order {{orderNumber}} has been successfully delivered.',
    supportNote: "We hope you're happy with your purchase. If you have any questions or concerns, please don't hesitate to contact us.",
    buttonLabel: 'View Order',
    thanksNote: 'Thank you for shopping with us!',
    orderNumberLabel: 'Order Number',
    textViewOrderPrefix: 'View your order',
  },
  ru: {
    subjectPrefix: 'Ваш заказ доставлен',
    title: 'Ваш заказ доставлен!',
    intro: 'Отличные новости! Ваш заказ {{orderNumber}} успешно доставлен.',
    supportNote: 'Надеемся, что вы довольны покупкой. Если у вас есть вопросы или замечания, пожалуйста, свяжитесь с нами.',
    buttonLabel: 'Открыть заказ',
    thanksNote: 'Спасибо за покупку!',
    orderNumberLabel: 'Номер заказа',
    textViewOrderPrefix: 'Открыть заказ',
  },
};

const paymentRequestCopyByLocale: Record<string, PaymentRequestEmailCopy> = {
  en: {
    subjectPrefix: 'Payment Request - Order',
    title: 'Payment Request',
    intro: 'Thank you for your order {{orderNumber}}!',
    paymentInstructions: 'Please complete your payment using the bank details below:',
    accountNumberLabel: 'Account Number',
    bankLabel: 'Bank',
    swiftLabel: 'SWIFT',
    receiptNote: 'After making the payment, please upload the receipt in your order page.',
    buttonLabel: 'View Order',
    orderNumberLabel: 'Order Number',
    textIntro: 'Please complete your payment.',
    textViewOrderPrefix: 'View order',
  },
  ru: {
    subjectPrefix: 'Запрос на оплату - Заказ',
    title: 'Запрос на оплату',
    intro: 'Спасибо за ваш заказ {{orderNumber}}!',
    paymentInstructions: 'Пожалуйста, завершите оплату, используя банковские реквизиты ниже:',
    accountNumberLabel: 'Номер счёта',
    bankLabel: 'Банк',
    swiftLabel: 'SWIFT',
    receiptNote: 'После оплаты, пожалуйста, загрузите квитанцию на странице заказа.',
    buttonLabel: 'Открыть заказ',
    orderNumberLabel: 'Номер заказа',
    textIntro: 'Пожалуйста, завершите оплату.',
    textViewOrderPrefix: 'Открыть заказ',
  },
};

export function normalizeEmailLocale(locale?: string | null): string {
  return typeof locale === 'string' && locale.trim()
    ? locale.trim().toLowerCase().split('-')[0]
    : 'en';
}

export function getOrderConfirmationEmailCopy(locale?: string | null): OrderConfirmationEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return orderConfirmationCopyByLocale[normalized] || orderConfirmationCopyByLocale.en;
}

export function getPasswordResetEmailCopy(locale?: string | null): PasswordResetEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return passwordResetCopyByLocale[normalized] || passwordResetCopyByLocale.en;
}

export function getEmailVerificationEmailCopy(locale?: string | null): EmailVerificationEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return emailVerificationCopyByLocale[normalized] || emailVerificationCopyByLocale.en;
}

export function getWelcomeEmailCopy(locale?: string | null): WelcomeEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return welcomeCopyByLocale[normalized] || welcomeCopyByLocale.en;
}

export function getShippingEmailCopy(locale?: string | null): ShippingEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return shippingCopyByLocale[normalized] || shippingCopyByLocale.en;
}

export function getDeliveryEmailCopy(locale?: string | null): DeliveryEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return deliveryCopyByLocale[normalized] || deliveryCopyByLocale.en;
}

export function getPaymentRequestEmailCopy(locale?: string | null): PaymentRequestEmailCopy {
  const normalized = normalizeEmailLocale(locale);
  return paymentRequestCopyByLocale[normalized] || paymentRequestCopyByLocale.en;
}
