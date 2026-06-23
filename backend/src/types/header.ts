export interface HeaderSettings {
  id: string;
  isActive: boolean;
  // Logo settings
  logoType: 'TEXT' | 'IMAGE' | 'SVG';
  logoText: string;
  logoImageUrl?: string;
  logoSvg?: string;
  logoPosition: 'LEFT' | 'CENTER' | 'RIGHT';
  logoSize: string;
  logoColor: string;
  logoLink: string;
  // Header styling
  backgroundColor: string;
  backgroundOpacity: number;
  backdropBlur: number;
  dropdownBackgroundOpacity: number;
  dropdownBackdropBlur: number;
  textColor: string;
  borderColor: string;
  shadowEnabled: boolean;
  stickyEnabled: boolean;
  height: string;
  // Category links settings
  categoryLinksEnabled: boolean;
  categoryLinksPosition: 'LEFT' | 'CENTER' | 'RIGHT';
  categoryLinksColor: string;
  categoryLinksHoverColor: string;
  categoryLinksActiveColor: string;
  categoryLinksFontSize: string;
  categoryLinksFontWeight: string;
  headerMenuDropdown: boolean;
  // Icon settings
  iconsEnabled: boolean;
  iconsPosition: 'LEFT' | 'CENTER' | 'RIGHT';
  iconsColor: string;
  iconsHoverColor: string;
  iconsSize: string;
  // Custom icons configuration
  customIcons?: Array<{
    name: string;
    svg: string;
    link: string;
    visible: boolean;
  }>;
  // Conditions for categories
  categoryConditions?: Array<{
    categoryId: string;
    condition: string;
    visible: boolean;
  }>;
  // Quick Links for dropdown menu
  quickLinks?: Array<{
    label: string;
    link: string;
    visible: boolean;
  }>;
  // Navigation blocks configuration
  navigationBlocks?: Array<{
    id: string;
    type: 'language' | 'search' | 'profile' | 'wishlist' | 'cart' | 'custom';
    enabled: boolean;
    icon?: string; // SVG code
    link?: string;
    label?: string;
    order: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export interface CreateHeaderSettingsDto {
  isActive?: boolean;
  logoType?: 'TEXT' | 'IMAGE' | 'SVG';
  logoText?: string;
  logoImageUrl?: string;
  logoSvg?: string;
  logoPosition?: 'LEFT' | 'CENTER' | 'RIGHT';
  logoSize?: string;
  logoColor?: string;
  logoLink?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  backdropBlur?: number;
  dropdownBackgroundOpacity?: number;
  dropdownBackdropBlur?: number;
  textColor?: string;
  borderColor?: string;
  shadowEnabled?: boolean;
  stickyEnabled?: boolean;
  height?: string;
  categoryLinksEnabled?: boolean;
  categoryLinksPosition?: 'LEFT' | 'CENTER' | 'RIGHT';
  categoryLinksColor?: string;
  categoryLinksHoverColor?: string;
  categoryLinksActiveColor?: string;
  categoryLinksFontSize?: string;
  categoryLinksFontWeight?: string;
  headerMenuDropdown?: boolean;
  iconsEnabled?: boolean;
  iconsPosition?: 'LEFT' | 'CENTER' | 'RIGHT';
  iconsColor?: string;
  iconsHoverColor?: string;
  iconsSize?: string;
  customIcons?: Array<{
    name: string;
    svg: string;
    link: string;
    visible: boolean;
  }>;
  categoryConditions?: Array<{
    categoryId: string;
    condition: string;
    visible: boolean;
  }>;
  quickLinks?: Array<{
    label: string;
    link: string;
    visible: boolean;
  }>;
  navigationBlocks?: Array<{
    id: string;
    type: 'language' | 'search' | 'profile' | 'wishlist' | 'cart' | 'custom';
    enabled: boolean;
    icon?: string;
    link?: string;
    label?: string;
    order: number;
  }>;
}

export interface UpdateHeaderSettingsDto extends Partial<CreateHeaderSettingsDto> {}
