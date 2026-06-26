export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100000] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      Pular para o conteúdo
    </a>
  );
}
