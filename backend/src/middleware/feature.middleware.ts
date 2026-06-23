import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { FeatureSettings } from '../types/settings';

export interface FeatureRequest extends Request {
  features?: FeatureSettings;
}

export const loadFeatures = async (
  req: FeatureRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const features = await settingsService.getAllSettings();
    req.features = features;
    next();
  } catch (error) {
    console.error('Failed to load features:', error);
    // Continue with defaults if loading fails
    next();
  }
};

export const requireFeature = (featureKey: keyof FeatureSettings) => {
  return async (req: FeatureRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isEnabled = await settingsService.isFeatureEnabled(featureKey);
      
      if (!isEnabled) {
        res.status(403).json({
          error: `Feature ${featureKey} is disabled`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to check feature status',
      });
    }
  };
};
