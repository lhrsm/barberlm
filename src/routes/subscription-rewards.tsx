import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subscription-rewards")({
  beforeLoad: () => {
    throw redirect({ to: "/loyalty" });
  },
  component: () => null,
});
