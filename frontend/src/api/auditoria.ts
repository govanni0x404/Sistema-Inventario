import { api } from "./client";
import type { RegistroAuditoria } from "../types/auditoria";
import type { ConsultaParams } from "../types/consulta";

function qs(params?: ConsultaParams) {
  const q = new URLSearchParams();
  if (params?.desde && params?.hasta) {
    q.set("desde", params.desde);
    q.set("hasta", params.hasta);
  } else if (params?.dias) {
    q.set("dias", String(params.dias));
  }
  const query = q.toString();
  return query ? `?${query}` : "";
}

export const auditoriaApi = {
  listar: (params?: ConsultaParams) => api.get<RegistroAuditoria[]>(`/auditoria${qs(params)}`),
};
