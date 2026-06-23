import prisma from '../config/database';
import { CreateHeaderSettingsDto, UpdateHeaderSettingsDto } from '../types/header';
import {
  sanitizeHeaderSettingsInput,
  sanitizeHeaderSettingsOutput,
} from '../utils/header-sanitize';

const DEFAULT_HEADER_SETTINGS: CreateHeaderSettingsDto = {
  isActive: true,
  logoType: 'TEXT',
  logoText: 'LOGO',
  logoPosition: 'CENTER',
  logoSize: 'text-2xl',
  logoColor: '#000000',
  logoLink: '/',
  backgroundColor: '#ffffff',
  backgroundOpacity: 92,
  backdropBlur: 12,
  dropdownBackgroundOpacity: 96,
  dropdownBackdropBlur: 16,
  textColor: '#000000',
  borderColor: '#e5e7eb',
  shadowEnabled: true,
  stickyEnabled: true,
  height: 'h-12',
  categoryLinksEnabled: true,
  categoryLinksPosition: 'LEFT',
  categoryLinksColor: '#4b5563',
  categoryLinksHoverColor: '#000000',
  categoryLinksActiveColor: '#000000',
  categoryLinksFontSize: 'text-sm',
  categoryLinksFontWeight: 'font-medium',
  headerMenuDropdown: false,
  quickLinks: [
    { label: 'My Account', link: '/account/profile', visible: true },
    { label: 'Orders', link: '/account/orders', visible: true },
    { label: 'Shipping', link: '/account/orders', visible: true },
    { label: 'Returns', link: '/account/returns', visible: true },
  ],
  iconsEnabled: true,
  iconsPosition: 'RIGHT',
  iconsColor: '#4b5563',
  iconsHoverColor: '#000000',
  iconsSize: 'w-5 h-5',
};

export class HeaderService {
  // Helper to check if headerSettings model is available
  private ensureHeaderSettingsModel() {
    // Check if prisma client has headerSettings property
    if (!prisma || typeof prisma !== 'object') {
      throw new Error('Prisma client is not initialized');
    }
    
    // Use type assertion to check if headerSettings exists
    // This is a runtime check that works even if TypeScript types are stale
    const prismaAny = prisma as any;
    
    // Check if headerSettings exists
    if (!prismaAny.headerSettings) {
      const availableModels = Object.keys(prismaAny).filter(key => !key.startsWith('$') && !key.startsWith('_'));
      console.error('❌ HeaderSettings model not found in Prisma client');
      console.error('Available models:', availableModels);
      console.error('Total models:', availableModels.length);
      
      // Check if it's a caching issue
      if (availableModels.length > 0 && !availableModels.includes('headerSettings')) {
        throw new Error(
          'HeaderSettings model not available in Prisma client. ' +
          'The server is using a cached version. Please:\n' +
          '1. Stop the server\n' +
          '2. Run: cd backend && npx prisma generate\n' +
          '3. Restart the server'
        );
      }
      
      throw new Error('HeaderSettings model not available in Prisma client. Please run: npx prisma generate && restart the server');
    }
  }

  async getSettings(): Promise<any> {
    try {
      this.ensureHeaderSettingsModel();
    } catch (e) {
      console.warn('[Header] Prisma client missing headerSettings, returning defaults:', (e as Error).message);
      return { ...DEFAULT_HEADER_SETTINGS };
    }
    try {
      const settings = await prisma.headerSettings.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      if (!settings) {
        return this.createDefaultSettings();
      }

      return sanitizeHeaderSettingsOutput(settings);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('table') || msg.includes('connect') || msg.includes('ECONNREFUSED')) {
        console.warn('[Header] DB/table issue (getSettings), returning defaults:', msg);
        return { ...DEFAULT_HEADER_SETTINGS };
      }
      throw error;
    }
  }

  async getActiveSettings(): Promise<any> {
    try {
      this.ensureHeaderSettingsModel();
    } catch (e) {
      console.warn('[Header] Prisma client missing headerSettings, returning defaults:', (e as Error).message);
      return { ...DEFAULT_HEADER_SETTINGS };
    }

    try {
      const settings = await prisma.headerSettings.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (!settings) {
        return this.createDefaultSettings();
      }

      return sanitizeHeaderSettingsOutput(settings);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('table') || msg.includes('connect') || msg.includes('ECONNREFUSED')) {
        console.warn('[Header] DB/table issue, returning defaults:', msg);
        return { ...DEFAULT_HEADER_SETTINGS };
      }
      throw error;
    }
  }

  async createSettings(data: CreateHeaderSettingsDto, updatedBy?: string): Promise<any> {
    this.ensureHeaderSettingsModel();
    
    const settingsData = sanitizeHeaderSettingsInput({
      ...DEFAULT_HEADER_SETTINGS,
      ...data,
      updatedBy,
    });

    const created = await prisma.headerSettings.create({
      data: settingsData as any,
    });
    return sanitizeHeaderSettingsOutput(created);
  }

  async updateSettings(id: string, data: UpdateHeaderSettingsDto, updatedBy?: string): Promise<any> {
    this.ensureHeaderSettingsModel();
    
    const existing = await prisma.headerSettings.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Header settings not found');
    }

    const sanitizedData = sanitizeHeaderSettingsInput(data);

    const updated = await prisma.headerSettings.update({
      where: { id },
      data: {
        ...sanitizedData,
        updatedBy,
      } as any,
    });
    return sanitizeHeaderSettingsOutput(updated);
  }

  async updateOrCreateSettings(data: UpdateHeaderSettingsDto, updatedBy?: string): Promise<any> {
    this.ensureHeaderSettingsModel();
    
    try {
      const existing = await prisma.headerSettings.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      if (existing) {
        return this.updateSettings(existing.id, data, updatedBy);
      }

      return this.createSettings(data as CreateHeaderSettingsDto, updatedBy);
    } catch (error: any) {
      // If table doesn't exist, create default settings
      if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
        console.warn('HeaderSettings table does not exist. Creating default settings...');
        return this.createSettings(data as CreateHeaderSettingsDto, updatedBy);
      }
      throw error;
    }
  }

  async deleteSettings(id: string): Promise<void> {
    this.ensureHeaderSettingsModel();
    
    await prisma.headerSettings.delete({
      where: { id },
    });
  }

  private async createDefaultSettings(): Promise<any> {
    try {
      this.ensureHeaderSettingsModel();
    } catch {
      return sanitizeHeaderSettingsOutput({ ...DEFAULT_HEADER_SETTINGS });
    }
    try {
      const created = await prisma.headerSettings.create({
        data: DEFAULT_HEADER_SETTINGS as any,
      });
      return sanitizeHeaderSettingsOutput(created);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('table') || msg.includes('connect') || msg.includes('ECONNREFUSED')) {
        console.warn('[Header] Cannot create row, returning in-memory defaults:', msg);
        return sanitizeHeaderSettingsOutput({ ...DEFAULT_HEADER_SETTINGS });
      }
      throw error;
    }
  }
}

export const headerService = new HeaderService();
