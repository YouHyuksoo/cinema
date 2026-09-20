import type { ScreenCommand } from './screenCommands';

export type PendingConfirmation = { command: ScreenCommand; expiresAt: number };
export type ConfirmationReply = 'confirm' | 'cancel' | 'continue';
export const CONFIRMATION_TTL_MS = 120_000;

export function confirmationReply(message: string): ConfirmationReply {
  const normalized = message.trim().replace(/[.!?]+$/g, '');
  if (/^(?:응|어|네|예|그래|맞아|좋아|해|해줘|진행해|그렇게 해)$/.test(normalized)) return 'confirm';
  if (/^(?:아니|아니요|아냐|취소|취소해|하지 마|됐어)$/.test(normalized)) return 'cancel';
  return 'continue';
}

export function activeConfirmation(pending: PendingConfirmation | null, now = Date.now()): PendingConfirmation | null {
  return pending && pending.expiresAt > now ? pending : null;
}
