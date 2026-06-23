export interface MessengerContact {
  id: string;
  userId: string;
  type: 'TELEGRAM' | 'WHATSAPP' | 'VIBER' | 'OTHER';
  contactId: string;
  username?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessengerContactDto {
  type: 'TELEGRAM' | 'WHATSAPP' | 'VIBER' | 'OTHER';
  contactId: string;
  username?: string;
}

export interface UpdateMessengerContactDto {
  contactId?: string;
  username?: string;
  isActive?: boolean;
}
