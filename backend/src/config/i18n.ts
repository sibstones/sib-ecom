// Internationalization configuration
export const supportedLanguages = ['en', 'ru', 'fr', 'de', 'es', 'ja', 'zh', 'ko'];
export const defaultLanguage = 'en';

export const translations: Record<string, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.shop': 'Shop',
    'nav.lookbook': 'Lookbook',
    'nav.cart': 'Cart',
    'nav.account': 'Account',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'product.addToCart': 'Add to Bag',
    'cart.empty': 'Your cart is empty',
    'cart.total': 'Total',
    'order.placed': 'Order placed successfully',
  },
  ru: {
    'nav.home': 'Главная',
    'nav.shop': 'Магазин',
    'nav.lookbook': 'Lookbook',
    'nav.cart': 'Корзина',
    'nav.account': 'Аккаунт',
    'nav.login': 'Войти',
    'nav.logout': 'Выйти',
    'product.addToCart': 'Добавить в корзину',
    'cart.empty': 'Ваша корзина пуста',
    'cart.total': 'Итого',
    'order.placed': 'Заказ успешно размещен',
  },
};

export function t(key: string, lang: string = defaultLanguage): string {
  return translations[lang]?.[key] || translations[defaultLanguage][key] || key;
}
