import { categoriasApi } from "../api/categorias";
import CatalogoProductoManager from "../components/CatalogoProductoManager";

export default function CategoriasPage() {
  return <CatalogoProductoManager api={categoriasApi} singular="categoría" plural="categorías" ejemplo="Ej. Lácteos" />;
}
