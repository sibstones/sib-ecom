export interface CreateLookbookDto {
  title: string;
  slug?: string;
  description?: string;
  season?: string;
  year?: number;
  isActive: boolean;
}

export interface UpdateLookbookDto extends Partial<CreateLookbookDto> {}

export interface CreateLookbookImageDto {
  lookbookId: string;
  url: string;
  alt?: string;
  order: number;
}

export interface UpdateLookbookImageDto {
  url?: string;
  alt?: string;
  order?: number;
}

export interface CreateProductTagDto {
  lookbookImageId: string;
  productId: string;
  x: number; // Position X (0-1)
  y: number; // Position Y (0-1)
}
