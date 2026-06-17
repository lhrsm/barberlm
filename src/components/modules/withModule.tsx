import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleGuard } from "@/components/modules/ModuleGuard";
import { useModules, type ModuleKey } from "@/hooks/use-modules";
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
    const { isAllowed, isEnabled, isLoading } = useModules();

    if (isLoading) {
      return (
        <AppLayout>
          <div className="flex items-center justify-center min-h-[40vh] text-white/60">
            Carregando...
          </div>
        </AppLayout>
      );
    }

    if (!isAllowed(module) || !isEnabled(module)) {
      return (
        <AppLayout>
          <ModuleGuard module={module} title={title}>
            <div />
          </ModuleGuard>
        </AppLayout>
      );
    }

    return <Component {...props} />;
  };
}
