import { api } from "./client";
import type { DashboardResumen } from "../types/dashboard";

export const dashboardApi = {
  resumen: () => api.get<DashboardResumen>("/dashboard"),
};
