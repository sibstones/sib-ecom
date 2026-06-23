import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export interface CreatePartnerDocumentDto {
  partnerId: string;
  name: string;
  type: 'CONTRACT' | 'AGREEMENT' | 'OTHER';
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  expiresAt?: Date;
}

export class PartnerDocumentService {
  // Create document
  async createDocument(data: CreatePartnerDocumentDto) {
    return prisma.partnerDocument.create({
      data: {
        partnerId: data.partnerId,
        name: data.name,
        type: data.type,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        description: data.description,
        expiresAt: data.expiresAt,
      },
    });
  }

  // Get partner documents
  async getPartnerDocuments(partnerId: string, type?: string) {
    const where: Prisma.PartnerDocumentWhereInput = {
      partnerId,
      ...(type && { type }),
    };

    return prisma.partnerDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get document by ID
  async getDocumentById(documentId: string) {
    const document = await prisma.partnerDocument.findUnique({
      where: { id: documentId },
      include: {
        partner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    return document;
  }

  // Update document
  async updateDocument(documentId: string, data: Partial<CreatePartnerDocumentDto>) {
    return prisma.partnerDocument.update({
      where: { id: documentId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.fileUrl && { fileUrl: data.fileUrl }),
        ...(data.fileName && { fileName: data.fileName }),
        ...(data.fileSize !== undefined && { fileSize: data.fileSize }),
        ...(data.mimeType && { mimeType: data.mimeType }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      },
    });
  }

  // Delete document
  async deleteDocument(documentId: string) {
    return prisma.partnerDocument.delete({
      where: { id: documentId },
    });
  }
}

export const partnerDocumentService = new PartnerDocumentService();
