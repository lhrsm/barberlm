import { createFileRoute } from '@tanstack/react-router';
import { SecurityCentral } from '@/components/security/SecurityCentral';

export const Route = createFileRoute('/dashboard/settings/security')({
  component: SecurityCentral,
});
