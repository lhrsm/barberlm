import { createFileRoute } from "@tanstack/react-router";
import { CalendarComponent } from "./calendar.tsx";

export const Route = createFileRoute("/calendar")({
  component: CalendarComponent,
});
