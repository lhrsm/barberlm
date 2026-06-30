import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/loyalty")({
  component: LoyaltyLayout,
});

function LoyaltyLayout() {
  return <Outlet />;
}
