import { createFileRoute } from '@tanstack/react-router';
import { SecurityCentral } from '@/components/security/SecurityCentral';

export const Route = createFileRoute('/dashboard/settings/security')({
  component: () => (
    <div className="p-6 md:p-8">
      <SecurityCentral />
    </div>
  ),
});
