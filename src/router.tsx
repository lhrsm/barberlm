import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Route as KpisRoute } from "./routes/kpis";
import { Route as OperationalInsightsRoute } from "./routes/operational-insights";
import { Route as AIAssistantRoute } from "./routes/dashboard.assistente";
import { Route as CommandCenterRoute } from "./routes/dashboard.centro-de-comando";
import { Route as BIRoute } from "./routes/dashboard.bi";
import { Route as IntelligenceRoute } from "./routes/intelligence";

export const getRouter = () => {
  // Attach virtual routes to the existing layout tree
  try {
    KpisRoute.addChildren([
      IntelligenceRoute,
      AIAssistantRoute,
      OperationalInsightsRoute,
      CommandCenterRoute,
      BIRoute,
    ]);
  } catch (e) {
    console.warn("Virtual routes already attached or error during attachment");
  }

  const router = createRouter({
    routeTree,
    context: {},
  });

  return router;
};