'use client';

import { useParams } from 'next/navigation';
import { ProfileUserClient } from './ProfileUserClient';

export default function UserProfilePage() {
  const params = useParams();
  const raw = params?.userId;
  const userId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';

  if (!userId) {
    return null;
  }

  return <ProfileUserClient userId={userId} />;
}
