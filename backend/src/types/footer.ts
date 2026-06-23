export interface FooterColumn {
  title: string;
  links: Array<{
    text: string;
    url: string;
  }>;
}

export interface FooterLink {
  text: string;
  url: string;
}

/** Follow us: social network URLs (B&W icons: Instagram, TikTok, Facebook, YouTube) */
export interface FooterSocialLinks {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  youtube?: string;
}

export interface CreateFooterDto {
  brandName?: string;
  tagline?: string;
  columns?: FooterColumn[];
  copyright?: string;
  links?: FooterLink[];
  socialLinks?: FooterSocialLinks;
  isActive?: boolean;
}

export interface UpdateFooterDto {
  brandName?: string;
  tagline?: string;
  columns?: FooterColumn[];
  copyright?: string;
  links?: FooterLink[];
  socialLinks?: FooterSocialLinks;
  isActive?: boolean;
}
