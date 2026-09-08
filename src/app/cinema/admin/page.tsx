import type { Metadata } from 'next';
import { HatcheryAdmin } from '@/cinema/admin/HatcheryAdmin';

export const metadata: Metadata = { title: 'HATCHERY 데이터 소스 관리' };

export default function AdminPage() {
  return <HatcheryAdmin />;
}
