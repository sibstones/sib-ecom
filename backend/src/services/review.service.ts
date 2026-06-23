import prisma from '../config/database';
import { CreateReviewDto, UpdateReviewDto } from '../types/review';

export class ReviewService {
  async getByProduct(productId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where: {
          productId,
          isPublished: true,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productReview.count({
        where: {
          productId,
          isPublished: true,
        },
      }),
    ]);

    // Calculate average rating
    const avgRating = await prisma.productReview.aggregate({
      where: {
        productId,
        isPublished: true,
      },
      _avg: {
        rating: true,
      },
    });

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      averageRating: avgRating._avg.rating || 0,
      totalReviews: total,
    };
  }

  async getByUser(userId: string) {
    return prisma.productReview.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              take: 1,
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateReviewDto) {
    // Check if user already reviewed this product
    const existing = await prisma.productReview.findUnique({
      where: {
        productId_userId: {
          productId: data.productId,
          userId,
        },
      },
    });

    if (existing) {
      throw new Error('You have already reviewed this product');
    }

    // If orderId provided, mark as verified purchase
    const isVerified = !!data.orderId;

    return prisma.productReview.create({
      data: {
        productId: data.productId,
        userId,
        orderId: data.orderId,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        isVerified,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(userId: string, reviewId: string, data: UpdateReviewDto) {
    // Verify ownership
    const review = await prisma.productReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },
    });

    if (!review) {
      throw new Error('Review not found or access denied');
    }

    return prisma.productReview.update({
      where: { id: reviewId },
      data: {
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.comment !== undefined && { comment: data.comment }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async delete(userId: string, reviewId: string) {
    // Verify ownership or admin
    const review = await prisma.productReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },
    });

    if (!review) {
      throw new Error('Review not found or access denied');
    }

    return prisma.productReview.delete({
      where: { id: reviewId },
    });
  }

  async getProductStats(productId: string) {
    const stats = await prisma.productReview.aggregate({
      where: {
        productId,
        isPublished: true,
      },
      _avg: { rating: true },
      _count: true,
    });

    const ratingDistribution = await prisma.productReview.groupBy({
      by: ['rating'],
      where: {
        productId,
        isPublished: true,
      },
      _count: true,
    });

    return {
      averageRating: stats._avg.rating || 0,
      totalReviews: stats._count,
      ratingDistribution: ratingDistribution.reduce(
        (acc, item) => {
          acc[item.rating] = item._count;
          return acc;
        },
        {} as Record<number, number>
      ),
    };
  }
}

export const reviewService = new ReviewService();
