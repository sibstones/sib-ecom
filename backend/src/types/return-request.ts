import { z } from 'zod';

export const CreateReturnRequestSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(['PRODUCT_NOT_DELIVERED', 'CUSTOMER_NOT_RECEIVED', 'CUSTOMER_REQUESTED']),
  customerNotes: z.string().optional(),
  items: z.array(
    z.object({
      orderItemId: z.string().uuid(),
      quantity: z.number().int().positive(),
      itemStatus: z.enum(['WRITE_OFF', 'RETURN_TO_SALE']).default('WRITE_OFF'),
      warehouseId: z.string().uuid().optional(),
    })
  ),
});

export type CreateReturnRequestDto = z.infer<typeof CreateReturnRequestSchema>;

export const ProcessReturnRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED']),
  refundMethod: z.enum(['STRIPE', 'BANK_TRANSFER', 'MANUAL']).optional(),
  refundAmount: z.number().positive().optional(),
  pickupMethod: z.enum(['COURIER', 'POST', 'PICKUP']).optional(),
  pickupAddress: z.string().optional(),
  pickupDate: z.string().datetime().optional(),
  pickupNotes: z.string().optional(),
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        returnRequestItemId: z.string().uuid(),
        itemStatus: z.enum(['WRITE_OFF', 'RETURN_TO_SALE']),
        warehouseId: z.string().uuid().optional(),
        replacementProductId: z.string().uuid().optional(),
        replacementVariantId: z.string().uuid().optional(),
      })
    )
    .optional(),
});

export type ProcessReturnRequestDto = z.infer<typeof ProcessReturnRequestSchema>;
