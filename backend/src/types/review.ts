export interface CreateReviewDto {
  productId: string;
  orderId?: string;
  rating: number; // 1-5
  title?: string;
  comment?: string;
}

export interface UpdateReviewDto {
  rating?: number;
  title?: string;
  comment?: string;
}
