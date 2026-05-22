import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tutorials")({
  component: () => <div>Tutorials Page</div>,
});
