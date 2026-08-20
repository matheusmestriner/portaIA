export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationChannelAdapter {
  send(recipient: string, message: string): Promise<NotificationSendResult>;
  isConfigured(): boolean;
}
