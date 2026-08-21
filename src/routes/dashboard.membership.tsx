import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/membership")({
  beforeLoad: () => {
    throw redirect({ to: "/subscriptions" });
  },
});
