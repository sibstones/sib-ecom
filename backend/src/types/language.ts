export interface Language {
  id: string;
  code: string;
  name: string;
  nameNative?: string;
  flag?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLanguageDto {
  code: string;
  name: string;
  nameNative?: string;
  flag?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdateLanguageDto {
  name?: string;
  nameNative?: string;
  flag?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}
