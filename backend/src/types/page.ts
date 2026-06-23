export interface PageDto {
  slug: string;
  title: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
}

export interface CreatePageDto extends PageDto {}

export interface UpdatePageDto extends Partial<PageDto> {}
