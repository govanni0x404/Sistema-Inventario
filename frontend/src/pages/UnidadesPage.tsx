import { unidadesApi } from "../api/unidades";
import CatalogoProductoManager from "../components/CatalogoProductoManager";

export default function UnidadesPage() {
  return <CatalogoProductoManager api={unidadesApi} singular="unidad" plural="unidades" ejemplo="Ej. Kilogramo" />;
}
