import type { Metadata } from 'next';
import { HatcheryAiSettings } from '@/cinema/admin/HatcheryAiSettings';

export const metadata: Metadata = { title: 'HATCHERY AI 설정' };

export default function AiSettingsPage() {
  return <HatcheryAiSettings />;
}
