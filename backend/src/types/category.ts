export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  isMain: boolean;
  createdAt: Date;
  updatedAt: Date;
  parent?: Category;
  children?: Category[];
  _count?: {
    products: number;
  };
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  isMain?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  isMain?: boolean;
}
