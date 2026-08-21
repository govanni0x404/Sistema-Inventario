import { api } from "./client";
import type { DashboardResumen } from "../types/dashboard";

export const dashboardApi = {
  resumen: (params?: { dias?: number; desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams();
    if (params?.desde && params?.hasta) {
      qs.set("desde", params.desde);
      qs.set("hasta", params.hasta);
    } else if (params?.dias) {
      qs.set("dias", String(params.dias));
    }
    const query = qs.toString();
    return api.get<DashboardResumen>(`/dashboard${query ? `?${query}` : ""}`);
  },
};
