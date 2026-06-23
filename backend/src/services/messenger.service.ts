import prisma from '../config/database';
import { CreateMessengerContactDto, UpdateMessengerContactDto } from '../types/messenger';

export class MessengerService {
  async getContacts(userId: string) {
    return prisma.messengerContact.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getContact(userId: string, type: string) {
    return prisma.messengerContact.findFirst({
      where: { userId, type, isActive: true },
    });
  }

  async createContact(userId: string, data: CreateMessengerContactDto) {
    return prisma.messengerContact.create({
      data: {
        userId,
        type: data.type,
        contactId: data.contactId,
        username: data.username,
      },
    });
  }

  async updateContact(id: string, userId: string, data: UpdateMessengerContactDto) {
    return prisma.messengerContact.update({
      where: { id, userId },
      data,
    });
  }

  async deleteContact(id: string, userId: string) {
    return prisma.messengerContact.update({
      where: { id, userId },
      data: { isActive: false },
    });
  }

  async sendNotification(
    userId: string,
    type: 'TELEGRAM' | 'WHATSAPP' | 'VIBER',
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    const contact = await this.getContact(userId, type);

    if (!contact) {
      return { success: false, error: 'Messenger contact not found' };
    }

    if (type === 'TELEGRAM') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: contact.contactId,
              text: message,
              parse_mode: 'HTML',
            }),
          });
          const data = (await res.json()) as { ok?: boolean; description?: string };
          if (!data.ok) {
            return { success: false, error: data.description || 'Telegram API error' };
          }
          return { success: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg };
        }
      }
    }

    // WhatsApp/Viber require external Business API integration — log for now
    if (type === 'WHATSAPP' || type === 'VIBER') {
      console.log(`[Messenger] ${type} integration requires Business API. Contact: ${contact.contactId}, message: ${message.slice(0, 50)}...`);
    }

    return { success: true };
  }
}

export const messengerService = new MessengerService();
