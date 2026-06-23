import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { twoFactorController } from '../controllers/two-factor.controller';
import { oauthController } from '../controllers/oauth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { getCsrfToken } from '../middleware/csrf.middleware';
import {
  loginLimiter,
  registrationLimiter,
  forgotPasswordLimiter,
  verifyEmailLimiter,
} from '../middleware/rate-limit.middleware';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
const router = Router();

// CSRF token for double-submit (no auth required; call before login/register)
router.get('/csrf-token', getCsrfToken);

// Validation schemas
const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    promoCode: z.string().optional(),
    captchaToken: z.string().optional(), // CAPTCHA token for bot protection
  }),
});

const loginSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
      captchaToken: z.string().optional(),
      twoFactorToken: z.string().min(10).optional(),
      twoFactorCode: z.string().regex(/^[0-9]{6,8}$/).optional(),
    })
    .refine(
      (b) => Boolean(b.twoFactorToken) === Boolean(b.twoFactorCode),
      { message: 'twoFactorToken and twoFactorCode must both be present or both omitted' }
    ),
});

const twoFaConfirmSchema = z.object({
  body: z.object({
    code: z.string().min(6).max(8).regex(/^[0-9]+$/),
  }),
});

const twoFaDisableSchema = z.object({
  body: z.object({
    password: z.string().min(1),
    code: z.string().min(6).max(8).regex(/^[0-9]+$/),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1),
  }),
});

const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
  }),
});

// Routes (rate limit only for login, register, forgot-password — the rest of the API is not touched)
router.post('/register', registrationLimiter, validate(registerSchema), authController.register.bind(authController));
router.post('/login', loginLimiter, validate(loginSchema), authController.login.bind(authController));
router.post(
  '/verify-email',
  verifyEmailLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);
router.post(
  '/resend-verification',
  forgotPasswordLimiter,
  optionalAuthenticate,
  validate(resendVerificationSchema),
  authController.resendVerification.bind(authController)
);
router.post('/refresh', authController.refresh.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/me', authenticate, authController.me.bind(authController));
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword.bind(authController));
router.post(
  '/2fa/setup/start',
  authenticate,
  twoFactorController.startSetup.bind(twoFactorController)
);
router.post(
  '/2fa/setup/confirm',
  authenticate,
  validate(twoFaConfirmSchema),
  twoFactorController.confirmSetup.bind(twoFactorController)
);
router.post(
  '/2fa/setup/cancel',
  authenticate,
  twoFactorController.cancelSetup.bind(twoFactorController)
);
router.post(
  '/2fa/disable',
  authenticate,
  validate(twoFaDisableSchema),
  twoFactorController.disable.bind(twoFactorController)
);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword.bind(authController));
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword.bind(authController));

// OAuth routes
router.get('/oauth/:provider/initiate', oauthController.initiate.bind(oauthController));
router.get('/oauth/:provider/callback', oauthController.callback.bind(oauthController));

export default router;
