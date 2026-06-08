import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  console.error("Critical Runtime Error:", error);

  // Auto-reload on chunk load errors
  if (typeof window !== 'undefined') {
    const isChunkError = 
      error.message?.includes("Failed to fetch dynamically imported module") || 
      error.message?.includes("error loading dynamically imported module");

    if (isChunkError) {
      const storageKey = 'last-chunk-error-reload';
      const lastReload = localStorage.getItem(storageKey);
      const now = Date.now();

      // Only auto-reload once every 30 seconds to avoid infinite loops
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        localStorage.setItem(storageKey, now.toString());
        window.location.reload();
        return null;
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Ops! Ocorreu um erro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Parece que há uma versão mais recente da plataforma disponível ou ocorreu um problema de conexão.
        </p>
        
        {error.message && (
          <div className="mt-4 text-left">
            <p className="text-[10px] font-bold text-destructive/50 mb-1 uppercase tracking-widest">Detalhes técnicos</p>
            <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-4 font-mono text-[10px] text-destructive border border-destructive/20 whitespace-pre-wrap">
              {error.message}
            </pre>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              // Clear cache and reload when clicking "Try again" manually
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                router.invalidate();
                reset();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
