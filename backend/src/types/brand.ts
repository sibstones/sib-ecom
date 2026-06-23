export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    products: number;
  };
}

export interface CreateBrandDto {
  name: string;
  slug?: string;
  logo?: string;
}

export interface UpdateBrandDto {
  name?: string;
  slug?: string;
  logo?: string | null;
}
