import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tutorials")({
  component: () => <div>Admin Tutorials Management</div>,
});
