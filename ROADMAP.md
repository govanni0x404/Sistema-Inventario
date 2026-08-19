# Roadmap de mejoras — Sistema de Inventario

Lista acordada con el usuario el 2026-08-19. Se trabaja en este orden, de arriba hacia
abajo, sin saltarse pasos. Cada vez que se retome el trabajo, revisar este archivo para
saber en qué quedó y seguir desde ahí.

- [x] **1. Imprimir / exportar ticket** — vista imprimible del ticket (Caja e Historial),
      exportar a PDF vía "Guardar como PDF" del diálogo de impresión del navegador.
- [ ] **2. Devoluciones / cancelaciones de venta** — anular una venta (total o parcial),
      restaurar stock, dejar registro de auditoría. Acción desde Historial.
      Diseño ya decidido, falta implementar:
      - Modelos nuevos `Devolucion` (ventaId, motivo, total, usuarioId, fecha) y
        `DevolucionItem` (devolucionId, ventaItemId, cantidad, subtotal). `Venta.total`
        queda inmutable (histórico); lo devuelto se calcula sumando `DevolucionItem`.
      - `POST /api/ventas/:id/devolucion` — body `{ items:[{ventaItemId,cantidad}], motivo? }`,
        transacción: valida cantidad <= (vendido - ya devuelto) por item, incrementa
        `producto.stock`, crea `MovimientoStock` (tipo "entrada", origen "devolucion",
        ventaId=venta original), crea `Devolucion` + `DevolucionItem`.
      - `GET /api/ventas/:id` debe incluir `devoluciones.items` para saber cuánto queda
        devolvible por item.
      - Gatear la mutación con `requireSeccion("historial")` (ahí vive el botón, en
        `VentaDetalleModal`).
      - Frontend: botón "Devolver" en `VentaDetalleModal` → dialog con cantidad por item
        (tope = restante) + motivo; refrescar detalle tras confirmar; badge "Devuelta" en
        la tabla de Historial si `devoluciones.length > 0`.
      - Falta correr `npx prisma migrate dev` (parar backend primero por el lock del
        engine, patrón ya usado varias veces en este proyecto).

      **Estado actual (siguiente paso exacto):** `schema.prisma` ya tiene los modelos
      `Devolucion`/`DevolucionItem` y sus relaciones inversas en `Venta`/`Usuario`/
      `VentaItem` — completo y consistente, pero la migración AÚN NO se corrió y el
      controller/rutas/frontend de devoluciones AÚN NO existen. Empezar por:
      1. ✅ Migración `20260819032019_devoluciones` aplicada — tablas `devoluciones` y
         `devolucion_items` ya existen en la BD. Backend sigue DETENIDO (falta
         `npm run dev` de nuevo en backend/ — verificar con curl a :4000/api/health y
         también :5173 por si el frontend se cayó).
      2. Implementar `crearDevolucion` en `ventas.controller.js` + incluir
         `devoluciones.items` en `obtener`.
      3. Ruta `POST /api/ventas/:id/devolucion` con `requireSeccion("historial")`.
      4. Frontend: tipos, api, `DevolucionDialog`, botón en `VentaDetalleModal`, badge
         en Historial.
- [ ] **3. Descuentos** — por producto y por ticket completo, en Caja.
- [ ] **4. Gestión de usuarios desde la app** — CRUD de usuarios (solo admin): crear,
      editar rol, activar/desactivar, resetear contraseña.
- [ ] **5. Código de barras** — campo en Producto; búsqueda en Caja reconoce
      lectura de escáner (equivale a tecleo rápido + Enter).
- [ ] **6. Importación masiva de productos** (CSV/Excel) — subir archivo, previsualizar,
      reportar errores fila por fila.
- [ ] **7. Exportar reportes** (ventas, turnos, stock) a Excel/CSV.
- [ ] **8. Rangos de fecha personalizados** en Dashboard/Historial (hoy/7/30/90 días/
      personalizado), no solo mes actual o 14 días fijos.
- [ ] **9. Seguridad / producción** — `JWT_SECRET` real vía variable de entorno propia
      (no el valor de desarrollo), rate limiting en login, notas de despliegue/HTTPS.
- [ ] **10. Pruebas automatizadas** — backend: controllers críticos (ventas, turnos,
      permisos).
- [ ] **11. Pulido de experiencia** — command palette (Cmd/Ctrl+K); catálogo real de
      Categorías de producto (como se hizo con Tipos de Turno, en vez de texto libre).

## Notas de contexto (para no tener que re-derivar)

- Stack: backend Express + Prisma + Postgres (`backend/`), frontend Vite + React +
  TypeScript + Tailwind v4 + shadcn/ui (`frontend/`), servidores de dev corriendo en
  `localhost:4000` y `localhost:5173`.
- Patrón establecido: lecturas de catálogo abiertas a cualquier usuario autenticado,
  mutaciones gateadas por `requireSeccion`/`requireAdmin`; nuevas secciones deben sumarse
  a `SECCIONES` en `backend/src/lib/permisos.js` y a `Seccion` en `frontend/src/types/auth.ts`.
- Hay ~34 ventas sintéticas (últimos 14 días) en la BD a propósito, para poblar el
  Dashboard — no borrar. La configuración de Permisos del rol cajero también es real
  (el usuario la configuró): no resetear.
- Usuarios de prueba: `admin@inventario.local` / `admin123`, `cajero@inventario.local` /
  `cajero123`.
