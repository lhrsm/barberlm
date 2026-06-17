import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleGuard } from "@/components/modules/ModuleGuard";
import type { ModuleKey } from "@/hooks/use-modules";
import type { ComponentType } from "react";

/**
 * Wraps a route component so that, when the module is disabled,
 * the AppLayout shell still renders and a friendly "module disabled"
 * screen appears in the main area.
 */
export function withModule<P extends object>(
  module: ModuleKey,
  title: string,
  Component: ComponentType<P>,
) {
  return function GuardedRoute(props: P) {
    return (
      <ModuleGuardWrapper module={module} title={title}>
        <Component {...props} />
      </ModuleGuardWrapper>
    );
  };
}

function ModuleGuardWrapper({
  module,
  title,
  children,
}: {
  module: ModuleKey;
  title: string;
  children: React.ReactNode;
}) {
  // Use a lightweight check: render children fully (they include AppLayout),
  // but if disabled, render AppLayout with the guard message instead.
  const { useModules } = require("@/hooks/use-modules") as typeof import("@/hooks/use-modules");
  const { isEnabled, isLoading } = useModules();

  if (isLoading) return <AppLayout><div /></AppLayout>;

  if (!isEnabled(module)) {
    return (
      <AppLayout>
        <ModuleGuard module={module} title={title}>
          <div />
        </ModuleGuard>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
