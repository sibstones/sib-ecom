import { Response } from 'express';
import { settingsService } from '../services/settings.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { DEFAULT_ONBOARDING, type OnboardingState } from '../types/onboarding';

const ONBOARDING_KEY = 'onboarding';

function parseOnboarding(value: unknown): OnboardingState {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return {
      completedAt: typeof o.completedAt === 'string' ? o.completedAt : null,
      currentStep: typeof o.currentStep === 'number' ? o.currentStep : 0,
      skipped: o.skipped === true,
      data: (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) ? (o.data as Record<string, unknown>) : {},
    };
  }
  return DEFAULT_ONBOARDING;
}

export class OnboardingController {
  async getStatus(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const value = await settingsService.getSetting(ONBOARDING_KEY);
      const state = parseOnboarding(value);
      res.json(state);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get onboarding status',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body as Partial<OnboardingState>;
      const current = await settingsService.getSetting(ONBOARDING_KEY);
      const state = parseOnboarding(current);

      const updated: OnboardingState = {
        completedAt: body.completedAt !== undefined ? body.completedAt : state.completedAt,
        currentStep: body.currentStep !== undefined ? body.currentStep : state.currentStep,
        skipped: body.skipped !== undefined ? body.skipped : state.skipped,
        data: { ...state.data, ...(body.data ?? {}) },
      };

      await settingsService.updateSetting(
        ONBOARDING_KEY,
        updated,
        'Admin onboarding progress',
        req.user?.userId
      );

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update onboarding',
      });
    }
  }

  async complete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body as { data?: Record<string, unknown> };
      const current = await settingsService.getSetting(ONBOARDING_KEY);
      const state = parseOnboarding(current);

      const updated: OnboardingState = {
        ...state,
        completedAt: new Date().toISOString(),
        skipped: false,
        data: { ...state.data, ...(body.data ?? {}) },
      };

      await settingsService.updateSetting(
        ONBOARDING_KEY,
        updated,
        'Admin onboarding completed',
        req.user?.userId
      );

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to complete onboarding',
      });
    }
  }

  async reset(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updated: OnboardingState = {
        completedAt: null,
        currentStep: 0,
        skipped: false,
        data: {},
      };

      await settingsService.updateSetting(
        ONBOARDING_KEY,
        updated,
        'Admin onboarding reset',
        req.user?.userId
      );

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to reset onboarding',
      });
    }
  }

  async skip(req: AuthRequest, res: Response): Promise<void> {
    try {
      const current = await settingsService.getSetting(ONBOARDING_KEY);
      const state = parseOnboarding(current);

      const updated: OnboardingState = {
        ...state,
        completedAt: new Date().toISOString(),
        skipped: true,
      };

      await settingsService.updateSetting(
        ONBOARDING_KEY,
        updated,
        'Admin onboarding skipped',
        req.user?.userId
      );

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to skip onboarding',
      });
    }
  }
}

export const onboardingController = new OnboardingController();
