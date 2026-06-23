export interface CardItem {
  id?: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  link?: string;
  borderRadius?: string;
  showTitleOnHover?: boolean;
  titleColor?: string;
}

export interface HomepageSectionDto {
  type:
    | 'hero'
    | 'collection'
    | 'editorial'
    | 'lookbook_preview'
    | 'card'
    | 'blog'
    | 'audio'
    | 'split_triple'
    | 'bleed_left'
    | 'bleed_right'
    | 'center_title_media'
    | 'text_block';
  title?: string;
  order: number;
  isActive: boolean;
  config?: {
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    buttonText?: string;
    buttonLink?: string;
    description?: string;
    products?: string[]; // Product IDs
    lookbookId?: string;
    // Card section config
    cards?: CardItem[];
    gridColumns?: string; // e.g., 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    gap?: string; // e.g., 'gap-4', 'gap-6'
    // Blog section config: displayMode 'latest' | 'featured', limit (number), postIds (string[])
    displayMode?: 'latest' | 'featured';
    limit?: number;
    postIds?: string[];
    // Audio section config: audioUrl, player customization
    playerVariant?: 'minimal' | 'bar' | 'compact';
    playerAccentColor?: string;
    playerBgColor?: string;
    showPlayPause?: boolean;
    showProgress?: boolean;
    showTime?: boolean;
    showVolume?: boolean;
    autoplay?: boolean;
    [key: string]: unknown;
  };
}

export interface CreateHomepageSectionDto extends HomepageSectionDto {}

export interface UpdateHomepageSectionDto extends Partial<HomepageSectionDto> {}
