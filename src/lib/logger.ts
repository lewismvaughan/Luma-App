/**
 * Logger utility
 * Logs in __DEV__ mode OR when EXPO_PUBLIC_APP_ENV is 'dev'
 * Disabled in production builds
 *
 * paymentDebug() always logs, even in production — used to diagnose
 * the payment-success-screen bug. Remove once resolved.
 */

const isDev = __DEV__ || process.env.EXPO_PUBLIC_APP_ENV === 'dev';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  /** Always logs, even in production. For payment flow debugging only. */
  paymentDebug: (...args: unknown[]) => {
    console.log('[PAYMENT_DEBUG]', ...args);
  },
};

export default logger;
