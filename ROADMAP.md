# Roadmap de mejoras — Sistema de Inventario

Lista acordada con el usuario el 2026-08-19. Se trabaja en este orden, de arriba hacia
abajo, sin saltarse pasos. Cada vez que se retome el trabajo, revisar este archivo para
saber en qué quedó y seguir desde ahí.

**Estado: lista original completa (11/11) — cerrada el 2026-08-20.** Todo backend +
frontend, probado end-to-end (curl y/o `npm test`), sin dejar datos de prueba en la BD de
desarrollo. Ver notas de contexto al final para constraints que siguen vigentes
(no borrar las ventas sintéticas, no resetear permisos del cajero) y para el setup de la
base de datos de pruebas si se clona el proyecto de nuevo.

## Ronda 2 — feedback del 2026-08-20 tras cerrar la lista original

Mismo criterio: cada punto completo (backend + frontend, migraciones si aplica, probado)
antes de seguir con el siguiente, en este orden.

**Estado: completa (4/4) — cerrada el 2026-08-21.**

- [x] **R2.1. Catálogo de Unidad** — igual patrón que Categoría/Tipo de Turno: modelo
      `Unidad` (nombre único, activo), `Producto.unidadId` reemplaza el texto libre
      `Producto.unidad`. Migración manual `20260820235328_unidades` (backfill dinámico
      del valor existente `"pieza"` + presets Kg/Litro/Caja/Paquete/Docena sembrados solo
      si no chocan case-insensitive con lo ya migrado), aplicada a `inventario_db` y
      `inventario_test`. `GET/POST/PUT/DELETE /api/unidades` (lectura abierta, mutación
      `requireAdmin`). Import CSV: columna `unidad` se busca por nombre (insensible a
      mayúsculas); si no coincide o no viene, cae a una unidad por defecto (`"pieza"` si
      existe, si no la primera alfabética) con nota de advertencia solo cuando el nombre
      vino y no matcheó. `tests/helpers.js` (`crearProducto`) actualizado para crear/
      reusar una unidad de prueba. Probado con curl (alta con unidad, alta sin unidad →
      400, import con match/sin-match/omitido) y `npm test` (13/13 verdes).
- [x] **R2.2. Categorías en vista propia** — `CategoriaManager` ya no vive embebido en
      Productos: página propia `CategoriasPage` en `/categorias`, nav admin-only junto a
      Usuarios/Permisos (mismo `RequireAdmin`).
- [x] **R2.3. Crear proveedor/unidad/categoría desde el modal de producto** —
      `QuickCreatePopover` (botón "+" junto al `Select`, popover con nombre + Crear) en
      `ProductoForm` para Categoría, Unidad y Proveedor; al crear, selecciona
      automáticamente lo recién creado y actualiza la lista en memoria sin recargar.
- [x] **R2.4. Pagar con hasta 2 formas de pago en Caja** — modelo `VentaPago` (ventaId,
      metodoPago, monto) reemplaza `Venta.metodoPago` (columna única). Migración manual
      `20260821000246_venta_pagos` (backfill 1:1: cada una de las 36 ventas existentes se
      convirtió en un `VentaPago` con su método y total original, verificado antes de
      borrar la columna vieja), aplicada a `inventario_db` y `inventario_test`. Backend
      valida `1 <= pagos.length <= 2` y que la suma de montos coincida con el total
      (tolerancia 0.01 por redondeo) → 400 si no. Efectos en cascada, todos actualizados:
      - `turnos.controller.js` (`resumenVentasDeTurno`): el arqueo ahora agrupa
        `VentaPago.monto` por método vía las ventas del turno (no `Venta.total` por
        `Venta.metodoPago`) — con esto una venta pagada mitad efectivo mitad tarjeta solo
        suma la parte en efectivo al esperado de caja, en vez de contar el total completo
        al método que antes se guardaba como "el" método de la venta.
      - `dashboard.controller.js` (`ventasPorMetodo`): mismo cambio de fuente.
      - `ventas.controller.js` `listar` (filtro `?metodoPago=`): filtra por
        `pagos: { some: { metodoPago } }`.
      - `clientes.controller.js` `obtener`: incluye `pagos` en el historial de compras.
      - Frontend: `CajaPage` (fila de pago por método con toggle de 3 botones; botón
        "Dividir en 2 formas de pago" agrega una segunda fila con montos que se
        autobalancean entre sí — editar uno recalcula el otro para que siempre sumen el
        total; botón Cobrar deshabilitado si no cuadran), `VentaDetalleModal` y
        `HistorialPage` (badges por cada pago, con monto cuando hay más de uno),
        `printTicket.ts` (desglose "método monto + método monto" en el ticket),
        `ClientesPage` (historial de compras muestra los métodos usados), `types/venta.ts`
        (`VentaPago`, `Venta.pagos`, `VentaInput.pagos` reemplaza `metodoPago`).
      - `tests/ventas.test.js`/`turnos.test.js` actualizados a `pagos:[...]`, +3 tests
        nuevos (pago dividido válido, rechazo por suma no coincidente, arqueo de turno con
        pago dividido — verifica que solo la parte en efectivo cuenta). 16/16 verdes.
      Probado también end-to-end con curl contra la BD real: venta dividida 50/50
      efectivo/tarjeta, arqueo de turno reflejó exactamente la parte en efectivo,
      dashboard y filtro de historial por método reflejaron ambos pagos por separado,
      rechazo 400 por suma no coincidente y por más de 2 pagos — venta de prueba limpiada
      y stock restaurado al terminar.
      **Refinamiento (2026-08-21, feedback del usuario):** las 2 formas de pago no pueden
      repetirse (si la primera es tarjeta, la segunda debe ser efectivo o transferencia).
      Backend: `.refine()` en `ventaSchema` rechaza pagos con `metodoPago` duplicado → 400
      "No puedes repetir la misma forma de pago" (test nuevo, 17/17 verdes). Frontend:
      en `CajaPage`, el botón de cada método se deshabilita en una fila si ya está
      elegido en la otra — imposible seleccionarlo dos veces desde la UI, sin depender
      solo de la validación del servidor.

## Ronda 3 — feedback del 2026-08-21

**Estado: completa (2/2).**

- [x] **R3.1. Editar el nombre de una Categoría** — `CategoriaManager` ganó edición
      inline: lápiz junto a cada categoría la vuelve un `Input` editable (guardar con
      Enter/blur/✓, cancelar con Escape/✗). El backend ya soportaba renombrar
      (`PUT /api/categorias/:id` con `nombre`) desde que se creó el catálogo — no
      necesitó cambios, solo la UI para llegar a esa acción. Probado con curl (rename
      exitoso) y en el componente (tsc limpio).
- [x] **R3.2. Sección para crear/editar roles** — no existía ningún lugar para gestionar
      roles más allá de los dos hardcodeados (`admin`/`cajero`) en el código. Nuevo
      catálogo `Rol` (nombre único, `protegido`, `activo`) — migración manual
      `20260821002045_roles` con backfill dinámico desde los valores ya usados en
      `usuarios`/`rol_permisos` (más "admin" y "cajero" garantizados aunque la tabla de
      usuarios esté vacía, para que la BD de test también quede sembrada), aplicada a
      `inventario_db` y `inventario_test`. `Usuario.rol` y `RolPermiso.rol` siguen siendo
      strings libres (no FK) por simplicidad — el catálogo es la fuente de verdad de qué
      nombres existen; **renombrar un rol propaga el cambio** a `Usuario.rol` y
      `RolPermiso.rol` en una transacción, para no dejar registros huérfanos. El rol
      `"admin"` es protegido: no se puede renombrar ni eliminar (todo el sistema lo
      compara como el literal `"admin"` — permitir renombrarlo rompería `requireAdmin` y
      los guardas de auto-bloqueo). Eliminar un rol en uso lo desactiva en vez de
      borrarlo (mismo patrón que Categoría/Unidad/Tipo de Turno).
      `GET/POST/PUT/DELETE /api/roles` (lectura abierta, mutación `requireAdmin`).
      `usuarios.controller.js` y `permisos.controller.js` dejaron de usar el array
      hardcodeado `ROLES`/`ROLES_CONFIGURABLES` de `lib/permisos.js` (eliminado, ya no se
      usa en ningún lado) — ahora validan/enumeran roles consultando la tabla `Rol` en
      vivo. Frontend: `RolManager` (mismo patrón de edición inline que Categoría, con
      badge "Protegido" para admin en vez de los controles de editar/desactivar/borrar),
      página propia `/roles` (nav admin-only). `UsuariosPage` reemplaza los `<Select>`
      de rol hardcodeados por los roles activos cargados de `/api/roles`; `types/auth.ts`
      cambió `Rol` de unión fija (`"admin" | "cajero"`) a `string`, ya que ahora un admin
      puede crear roles nuevos en cualquier momento.
      `tests/roles.test.js` nuevo (7 tests: gate de admin, alta, duplicado/nombre
      "admin" rechazado, admin protegido contra rename/delete, rename propaga a
      usuarios, delete en uso desactiva, delete sin uso borra). `tests/helpers.js` ganó
      `crearRolesBase()` y `resetDb()` ahora también limpia la tabla `roles` — esto
      obligó a actualizar `permisos.test.js` para sembrar roles explícitamente en su
      `beforeEach` (antes vivía de las filas que dejaba la migración, que ahora se
      borran entre tests). 24/24 tests verdes. Probado también end-to-end con curl
      contra la BD real: alta, aparece en `/api/permisos`, asignar a un usuario nuevo,
      rename propaga al usuario, delete-en-uso desactiva, admin rechaza rename (400) y
      delete (400) — todo limpiado al terminar, roles del dev quedaron en
      `["admin","cajero"]` como antes.

## Ronda 4 — lista del usuario del 2026-08-21

Lista larga, en el orden exacto que la dio el usuario. Decisiones confirmadas de
antemano (vía preguntas antes de empezar):
- **Cortesía**: no cuenta como ingreso — descuenta stock y queda en auditoría, pero no
  suma en KPIs de ventas ni en el efectivo esperado del arqueo de turno.
- **Botones de Caja**: "Limpiar" solo vacía el carrito (mantiene cliente/config
  elegidos); "Venta nueva" resetea todo (cliente, forma de pago, descuento) — mismo
  efecto que ya tiene el botón "Nueva venta" del diálogo post-cobro, pero disponible
  también antes de cobrar.
- **Bodegas**: stock real por bodega (no un catálogo simple) — cada producto tiene una
  cantidad distinta en cada bodega, con transferencias entre bodegas. Cambio de fondo al
  modelo de stock: `Producto.stock` pasa a ser un total cacheado (suma de
  `StockBodega`), actualizado transaccionalmente; existe una bodega "principal"
  protegida (no se puede borrar) donde ocurren las ventas de Caja; `MovimientoStock` gana
  `bodegaId`.
- **Familias de productos**: omitida — es lo mismo que Categoría, ya existe.

Mismo criterio de siempre: cada punto completo (backend + frontend, migraciones,
probado con curl y/o `npm test`) antes de seguir con el siguiente.

- [x] **R4.1. Venta en espera** — modelos `VentaEnEspera`/`VentaEnEsperaItem` (snapshot
      del carrito, sin tocar stock ni crear `Venta`). `GET/POST/DELETE
      /api/ventas-en-espera` (`requireSeccion("caja")`). Frontend: botón "Enviar" (con
      referencia opcional) en el ticket, botón "En espera" en la barra superior abre
      `VentasEnEsperaDialog` con lista + "Recuperar" (carga el carrito y lo borra de la
      lista) + descartar. Probado con curl end-to-end (crear, listar, eliminar).
- [x] **R4.2. Venta por cortesía** — `Venta.esCortesia`/`motivoCortesia`. Cuando
      `esCortesia`, `pagos` puede ir vacío (no crea `VentaPago`) y el motivo es
      obligatorio (`.refine()` en `ventaSchema`); descuenta stock igual que una venta
      normal. Excluida de KPIs de ventas (dashboard: `ventasHoy`/`ventasPeriodo`/
      `ventasPorDia`/`productosTop`) y del arqueo de turno (`resumenVentasDeTurno` filtra
      `esCortesia: false`; `ventasPorMetodo`/efectivo esperado ya la excluían solo con no
      tener `VentaPago`). Frontend: checkbox "Venta de cortesía" en Caja (oculta la
      selección de forma de pago, pide motivo obligatorio, botón cambia a "Registrar
      cortesía"), badge "Cortesía" en `VentaDetalleModal`/Historial/ticket impreso/CSV.
      2 tests nuevos + 1 de arqueo (27/27 verdes). Probado con curl: descuenta stock,
      no afecta `ventasHoy` del dashboard — limpiado al terminar.
- [x] **R4.3. Retiro e ingreso de dinero en caja** — modelo `MovimientoCaja`
      (turnoCajaId, tipo, monto, motivo, usuario). `POST/GET /api/movimientos-caja`
      (`requireSeccion("caja")`), siempre sobre el turno abierto actual. `montoEsperado`
      del arqueo = fondo inicial + efectivo vendido + ingresos - retiros
      (`resumenMovimientosCaja` en `turnos.controller.js`, usado en `obtener`/`cerrar`).
      Frontend: botón "Retiro/Ingreso" en Caja abre `MovimientoCajaDialog` (toggle
      retiro/ingreso, monto, motivo, lista del turno actual); `CerrarTurnoDialog` muestra
      ingresos/retiros en el resumen previo al cierre. 2 tests nuevos (29/29 verdes).
      Probado con curl end-to-end — limpiado al terminar.
- [x] **R4.4. Indicar vuelto en la caja** — 100% frontend, sin cambios de backend (el
      monto recibido nunca se envía a la API, solo se usa para calcular el vuelto en el
      cliente). Campo "Recibe (efectivo)" visible en Caja cuando el efectivo forma parte
      del pago (solo o dividido); si el monto recibido supera lo que corresponde en
      efectivo, `VueltoModal` se centra en pantalla y se autocierra a los 5s (con botón
      de cerrar manual vía el X del diálogo).
- [x] **R4.5. Botón de limpiar la caja** — implementado junto con R4.1 (`limpiarCarrito`
      en `CajaPage`): vacía carrito y descuento de ticket, mantiene cliente y forma de
      pago elegidos.
- [x] **R4.6. Botón de venta nueva en la caja** — implementado junto con R4.1
      (`resetCompleto` en `CajaPage`, reutilizado también tras cobrar y tras enviar a
      espera): resetea carrito, cliente, pagos, descuento, cortesía y monto recibido.
      Disponible en todo momento en el header del ticket, no solo tras cobrar.
- [x] **R4.7. Lista de precios — CRUD** y **R4.8. Precios por lista** (implementados
      juntos): modelos `ListaPrecio` (nombre único, activo) y `PrecioLista`
      (listaPrecioId+productoId único, precio) — un producto sin fila en `PrecioLista`
      para una lista dada usa `Producto.precioVenta` como respaldo. `POST
      /api/listas-precio` recibe `copiarPrecios: boolean`: si es true, en la misma
      transacción crea un `PrecioLista` por cada producto activo con su precio actual
      (punto de partida editable); si es false, arranca vacía. `GET/PUT/DELETE
      /api/listas-precio/:id`, `GET /api/listas-precio/:id/precios`,
      `PUT/DELETE /api/listas-precio/:id/precios/:productoId` (upsert / quitar override),
      todo bajo `requireSeccion("precios")` para mutar, lectura abierta. Frontend:
      `ListasPrecioPage` (panel de listas con edición inline de nombre, igual patrón que
      Categoría/Rol, + panel de precios por producto con click-to-edit y "quitar" para
      volver al precio base), nueva entrada de nav "Listas de precios" junto a Precios.
      5 tests nuevos (34/34 verdes). Probado con curl: crear con copia, editar override,
      eliminar — limpiado al terminar.
- [x] **R4.9. Elegir lista de precios en Caja** — selector "Lista de precios" en el
      ticket (solo aparece si hay al menos una lista activa); al elegir una, se cargan
      sus overrides (`GET /api/listas-precio/:id/precios`) a un mapa en memoria y
      `precioEfectivo(producto)` lo resuelve (override de la lista o precio base) tanto
      al agregar al carrito como en los precios mostrados en la búsqueda/accesos rápidos.
- [x] **R4.10. Sección Consultas** — nueva sección (`consultas` sumado a `SECCIONES`,
      configurable en Permisos como cualquier otra). Se extrajo el resolvedor de rango de
      fechas de `dashboard.controller.js` a `lib/rangoFechas.js` (compartido, evita
      duplicar la lógica una tercera vez). `consultas.controller.js` nuevo con 3
      endpoints con su propio rango de fechas (`?dias=` o `?desde=&hasta=`):
      `GET /api/consultas/productos-top` (top 20 configurable, excluye cortesías),
      `GET /api/consultas/ventas-por-metodo`, `GET /api/consultas/ventas-por-usuario`
      (nuevo — no existía; cuenta cortesías por separado sin sumarlas al total). Frontend:
      `ConsultasPage` con pestañas (`Tabs`, primitivo nuevo con `@radix-ui/react-tabs` —
      estaba instalado pero sin usar) — "Detalle de venta" y "Cierre de turnos" reutilizan
      directamente `<HistorialPage />`/`<TurnosPage />` como módulos (cero duplicación);
      los otros 3 son reportes nuevos con `RangoFechasSelector` (componente compartido,
      mismo patrón hoy/7/30/90/personalizado del Dashboard). Probado con curl contra la
      BD real: los 3 endpoints devuelven datos correctos con `dias=90`.
- [x] **R4.11. Sección Mantención — Bodegas** — CRUD de bodegas + stock real por bodega
      con transferencias. Modelos nuevos: `Bodega` (nombre único, direccion, `principal`
      boolean, activo) y `StockBodega` (bodegaId+productoId único, cantidad). Migración
      manual `20260821014751_bodegas` (crea ambas tablas, suma `bodegaId` a
      `MovimientoStock`, siembra una "Bodega Principal" y un `StockBodega` por cada
      producto existente igualando su `stock` actual, y setea `bodegaId` en los 8
      movimientos ya existentes) aplicada a `inventario_db` y `inventario_test`.
      **Diseño**: `Producto.stock` no se tocó en el esquema — sigue siendo un total
      cacheado (suma de `StockBodega` en todas las bodegas), así que casi todo el código
      existente (validación de Caja, alertas de stock bajo, `ProductosPage`, `StockPage`,
      dashboard) lo sigue leyendo sin saber que existen bodegas. Solo la bodega
      "principal" (protegida, no se puede renombrar/desactivar/eliminar) es donde ocurren
      las ventas de Caja y las devoluciones; el resto son de organización/almacenamiento,
      movibles solo por transferencia.
      Backend: `lib/stockBodega.js` (helpers compartidos `bodegaPrincipal`,
      `ajustarStockBodega` — crea o ajusta la fila `StockBodega` por delta, lanza 409 si
      quedaría negativa —, `inicializarStockProducto` — siembra una fila por bodega al
      crear un producto, con el stock inicial en la principal y 0 en el resto).
      `bodegas.controller.js`: `listar`/`stockDeBodega` (lectura abierta), `crear` (siembra
      `StockBodega` en 0 para todos los productos existentes), `actualizar`/`eliminar`
      (bloquean cualquier cambio sobre la principal; eliminar también bloquea si la
      bodega todavía tiene stock > 0 en algún producto), `transferir` (`POST
      /api/bodegas/transferencias`: decrementa origen e incrementa destino
      atómicamente, el total del producto no cambia, deja 2 `MovimientoStock` con
      `origen:"transferencia"` — salida en origen, entrada en destino). Mutación
      gateada `requireSeccion("bodega")` (mismo permiso que ya usaba la página de
      entradas/salidas). Efectos en cascada, todos actualizados para mantener
      `StockBodega` sincronizado con `Producto.stock`:
      - `productos.controller.js` (`crear` e `importar`): siembra `StockBodega` al crear
        un producto nuevo.
      - `ventas.controller.js` (`crear`/`crearDevolucion`): además de ajustar
        `Producto.stock`, ajusta `StockBodega` de la bodega principal y le asigna
        `bodegaId` a los `MovimientoStock` de venta/devolución.
      - `movimientosStock.controller.js` (entradas/salidas manuales de la página
        Bodega): ganó `bodegaId` opcional en el body (default: principal), ajusta ambas
        tablas en la misma transacción.
      Tests: `tests/helpers.js` ganó `crearBodegaPrincipal()` (las ventas dependen de que
      exista una bodega principal) y `resetDb()` ahora también limpia `stock_bodega`/
      `bodegas`; `crearProducto()` siembra su `StockBodega` en la principal si ya existe
      una (para no romper `ventas.test.js`/`turnos.test.js`, que ya llamaban a
      `crearProducto()` antes de vender). `tests/bodegas.test.js` nuevo (10 tests: gate de
      sección, alta siembra stock en 0, nombre duplicado rechazado, protección de la
      principal contra rename/desactivar/eliminar, bloqueo de eliminar bodega con stock,
      eliminar bodega vacía, transferencia mueve stock y deja 2 movimientos de auditoría,
      transferencia rechaza stock insuficiente, transferencia rechaza origen=destino,
      una venta descuenta el stock de la bodega principal). 44/44 tests verdes.
      Frontend: `types/bodega.ts`, `api/bodegas.ts`, `BodegasPage.tsx` nueva (panel de
      bodegas con edición inline igual patrón que Rol/Lista de precios + panel de stock
      de la bodega seleccionada + diálogo de transferencia con selector de producto/
      bodega destino/cantidad/motivo), nueva entrada de nav "Bodegas" en `/bodegas` junto
      a "Bodega" (la página de entradas/salidas, que ahora gana un selector de bodega en
      `MovimientoForm` cuando hay más de una activa, default la principal).
      Probado end-to-end con curl contra la BD real: crear bodega (siembra stock en 0),
      transferir 5 unidades entre bodegas (verificado que `Producto.stock` total no
      cambia, solo se redistribuye), rechazo 409 por transferencia con stock insuficiente,
      revertir la transferencia, eliminar la bodega de prueba (204), rechazo 400 al
      intentar renombrar/desactivar/eliminar la principal, movimiento manual con
      `bodegaId` explícito. Verificación final de integridad: `StockBodega` sumado por
      producto coincide exactamente con `Producto.stock` para los 5 productos reales
      (60/23/36/3/14), sin alterar las ventas sintéticas existentes.

**Estado: Ronda 4 completa (11/11) — cerrada el 2026-08-21.**

- [x] **1. Imprimir / exportar ticket** — vista imprimible del ticket (Caja e Historial),
      exportar a PDF vía "Guardar como PDF" del diálogo de impresión del navegador.
- [x] **2. Devoluciones / cancelaciones de venta** — anular una venta (total o parcial),
      restaurar stock, dejar registro de auditoría. Acción desde Historial.
      Implementado: modelos `Devolucion`/`DevolucionItem` (migración
      `20260819032019_devoluciones`), `POST /api/ventas/:id/devolucion` (valida
      cantidad <= restante por item, restaura stock, crea `MovimientoStock` tipo
      "entrada" origen "devolucion"), `GET /api/ventas/:id` incluye
      `devoluciones.items`, `listar` incluye devoluciones livianas (solo id) para el
      badge. Gateado con `requireSeccion("historial")`. Frontend: botón "Devolver" en
      `VentaDetalleModal` → `DevolucionDialog` (cantidad por item con tope = restante +
      motivo opcional), historial de devoluciones dentro del modal, badge "Devuelta" en
      Historial. Probado end-to-end con curl (creación, restauración de stock, rechazo
      409 al exceder lo disponible) y limpiado el registro de prueba.
- [x] **3. Descuentos** — por producto y por ticket completo, en Caja. Implementado como
      monto fijo (no porcentaje): `Venta.subtotal`/`descuento`/`total` y
      `VentaItem.descuento` (migración `20260820230655_descuentos_venta`, con backfill de
      `subtotal = total` en las 36 ventas existentes). Backend valida que ningún
      descuento supere el subtotal correspondiente (por item y de ticket) → 400 si lo
      excede. Frontend: input de descuento por línea en el carrito de Caja (con
      strikethrough del precio original) + input de descuento de ticket antes del TOTAL;
      desglose Subtotal/Descuento/Total en `VentaDetalleModal` y en el ticket impreso
      cuando el descuento es mayor a 0. Probado end-to-end con curl (cálculo correcto,
      rechazo 400 al exceder) y limpiada la venta de prueba.
- [x] **4. Gestión de usuarios desde la app** — CRUD de usuarios (solo admin): crear,
      editar rol, activar/desactivar, resetear contraseña. `Usuario.activo`/`creadoEn`
      (migración `20260820231059_usuarios_activo_creado`), `ROLES` en `lib/permisos.js`.
      `GET/POST /api/usuarios`, `PUT /api/usuarios/:id` (nombre/rol/activo),
      `PUT /api/usuarios/:id/password`, todo bajo `requireAdmin`. Guardas: un admin no
      puede desactivarse ni quitarse el rol admin a sí mismo; login/`/me` rechazan (403)
      cuentas desactivadas. Frontend: `UsuariosPage` (solo admin, nueva entrada de nav
      "Usuarios" junto a "Permisos"), diálogos de crear/editar/restablecer contraseña.
      Probado con curl (alta, duplicado 409, desactivar, login bloqueado 403, reset
      password, auto-bloqueo 400) y limpiado el usuario de prueba.
- [x] **5. Código de barras** — campo en Producto; búsqueda en Caja reconoce
      lectura de escáner (equivale a tecleo rápido + Enter). `Producto.codigoBarras`
      (opcional, único; migración manual `20260820231448_productos_codigo_barras`,
      escrita a mano porque `migrate dev` pedía confirmación interactiva por el warning
      de constraint único — se aplicó con `migrate deploy`). Backend valida duplicados y
      lo suma a la búsqueda `?q=` de productos. Frontend: campo en `ProductoForm`; en
      Caja, Enter en el buscador agrega directo al carrito si el texto coincide exacto
      con un código de barras o SKU (o si solo hay un resultado), tal como lo haría un
      lector de código de barras. Probado con curl (alta, duplicado 409, búsqueda) y
      limpiado el producto de prueba.
- [x] **6. Importación masiva de productos** (CSV) — subir archivo, previsualizar,
      reportar errores fila por fila. Nota de alcance: se implementó CSV (no .xlsx binario)
      porque el paquete npm `xlsx`/SheetJS tiene una vulnerabilidad alta sin parche
      (prototype pollution + ReDoS, GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9); se usó
      `papaparse` (sin vulnerabilidades) en su lugar. Un Excel se importa guardándolo
      primero como CSV, indicado en el propio diálogo. El parseo es 100% client-side
      (frontend), el backend solo recibe JSON ya parseado — no hay `multer` ni
      dependencia de parseo en el servidor.
      Backend: `POST /api/productos/importar` procesa fila por fila (no en una sola
      transacción) para poder reportar éxito/error por fila; SKU existente → actualiza
      (sin tocar stock, igual que el PUT normal); SKU nuevo → crea con el stock inicial
      de la fila; duplicados de código de barras y de proveedor (por nombre, no
      encontrado = advertencia no bloqueante) se validan por fila. Límite de 2000 filas,
      `express.json` subido a 5mb para soportar lotes grandes.
      Frontend: `ImportarProductosDialog` (botón "Importar" en Productos) — selecciona
      CSV, normaliza encabezados (alias case-insensitive), previsualiza hasta 50 filas,
      confirma import, muestra resumen creados/actualizados/errores y detalle por fila.
      Probado con curl (alta, error de validación, colisión de SKU dentro del mismo lote
      resuelta como update) y limpiados los productos de prueba.
- [x] **7. Exportar reportes** (ventas, turnos, stock) a CSV. Mismo criterio de alcance
      que el punto 6: CSV en vez de .xlsx binario (sin dependencias nuevas ni riesgo de
      seguridad — `lib/exportCsv.ts` construye el CSV a mano con BOM UTF-8 y dispara la
      descarga vía Blob, sin ninguna librería). Botón "Exportar CSV" en Historial (respeta
      los filtros activos), Turnos y Stock (respeta búsqueda/filtro de stock bajo).
- [x] **8. Rangos de fecha personalizados** en Dashboard/Historial (hoy/7/30/90 días/
      personalizado), no solo mes actual o 14 días fijos.
      Backend: `GET /api/dashboard?dias=1|7|30|90` o `?desde=&hasta=` (personalizado tiene
      prioridad); "Ventas de hoy" sigue siendo el día calendario fijo, el resto de KPIs
      (`ventasPeriodo`, `ticketPromedioPeriodo`), el gráfico por día, ventas por método y
      productos top ahora usan el rango seleccionado en vez de "mes actual" fijo.
      `GET /api/ventas` ganó `desde`/`hasta` (además del `fecha` de un solo día que ya
      tenía). Frontend: selector de rango (Hoy/7/30/90/Personalizado) en Dashboard
      (default 30 días) y en Historial (default Hoy, mutuamente exclusivo con el filtro
      de turno, igual que antes).
      Bug encontrado y corregido de paso: `claveDia()` en el dashboard usaba
      `toISOString().slice(0,10)` (UTC) sobre fin-de-día en hora local; con el servidor en
      `America/Santiago` (UTC-4) el fin de día local caía en el día siguiente en UTC, así
      que el rango reportado (`rango.hasta` y el último bucket del gráfico) se corría un
      día hacia adelante. Se cambió a componentes de fecha locales
      (`getFullYear/getMonth/getDate`), verificado con curl.
- [x] **9. Seguridad / producción** — `JWT_SECRET` real vía variable de entorno propia
      (no el valor de desarrollo), rate limiting en login, notas de despliegue/HTTPS.
      `backend/src/lib/jwt.js` ahora falla al arrancar (`throw` a nivel de módulo) si
      `NODE_ENV=production` y `JWT_SECRET` está vacío, es uno de los valores de ejemplo
      (`change_me`/`dev_secret_change_me_in_production`) o mide menos de 32 caracteres;
      en desarrollo sigue funcionando igual que antes. `POST /api/auth/login` limitado a
      10 intentos/IP cada 15 min (`express-rate-limit`, sin vulnerabilidades — 0 en
      `npm audit`; los intentos exitosos no cuentan contra el límite). `app.set("trust
      proxy", 1)` en producción para que el rate limit vea la IP real detrás de un
      reverse proxy. Notas de despliegue/HTTPS/migraciones en `DEPLOY.md` (nuevo, raíz
      del proyecto). Probado: guard de producción rechaza secreto débil y acepta uno
      fuerte (`node -e` con `NODE_ENV=production`); rate limit verificado con 11 intentos
      de login (10 pasan, el 11 da 429).
- [x] **10. Pruebas automatizadas** — backend: controllers críticos (ventas, turnos,
      permisos). Jest + Supertest, contra una base de datos de pruebas dedicada
      (`inventario_test`, mismo servidor Postgres/usuario que dev, distinta BD) para no
      tocar nunca la BD de desarrollo. `backend/tests/setup.js` fuerza `NODE_ENV=test` y
      carga `backend/.env.test` (gitignored, igual que `.env`) antes de que cualquier
      test importe la app — así Prisma nunca apunta a `inventario_db` durante los tests.
      `backend/tests/helpers.js` trae `resetDb()` (limpia todas las tablas entre tests) y
      factories (`crearUsuario`, `crearProducto`, `crearTipoTurno`).
      13 tests en 3 suites, `npm test` (`jest --runInBand`) en `backend/`:
      - `ventas.test.js`: bloqueo sin turno abierto, cálculo correcto de descuento por
        item + por ticket, rechazo si el descuento excede el subtotal, rechazo por stock
        insuficiente, devolución restaura stock y rechaza exceder lo disponible.
      - `turnos.test.js`: apertura, bloqueo de doble apertura, cálculo de
        esperado/diferencia en el cierre (fondo inicial + efectivo vendido), bloqueo de
        doble cierre.
      - `permisos.test.js`: `requireAdmin` bloquea no-admins, default "permitido" sin
        configuración previa, actualizar permisos bloquea al rol afectado sin afectar al
        admin, login rechazado (403) para usuario desactivado.
      Setup para clonar el proyecto de nuevo: crear la BD `inventario_test`, correr
      `DATABASE_URL=...inventario_test npx prisma migrate deploy` una vez, y crear
      `backend/.env.test` (mismo formato que `.env.example`, apuntando a `inventario_test`).
- [x] **11. Pulido de experiencia** — command palette (Cmd/Ctrl+K); catálogo real de
      Categorías de producto (como se hizo con Tipos de Turno, en vez de texto libre).
      **Categorías**: modelo `Categoria` (id, nombre único, activo) + `Producto.categoriaId`
      reemplazando el antiguo `Producto.categoria` (texto libre). Migración
      `20260820233929_categorias` (manual, con backfill dinámico: crea una `Categoria`
      por cada valor distinto ya usado — `Bebidas`/`Abarrotes`/`Limpieza` en la BD dev —
      usando `gen_random_uuid()` nativo de Postgres, migra `categoriaId` por join de texto
      y recién ahí borra la columna vieja) aplicada a `inventario_db` **y**
      `inventario_test`. `GET/POST/PUT/DELETE /api/categorias` (lectura abierta, mutación
      `requireAdmin`, igual que Tipos de Turno). Búsqueda de productos (`?q=`) y la
      importación masiva (columna `categoria` del CSV → lookup por nombre, igual patrón
      que `proveedor`: no encontrada = advertencia no bloqueante) actualizadas. Frontend:
      `CategoriaManager` (mismo patrón que `TipoTurnoManager`, visible solo para admin en
      Productos), `ProductoForm` cambia el campo de texto libre por un `Select`.
      **Command palette**: `CommandPalette.tsx`, atajo global Ctrl/Cmd+K (listener en
      `AppLayout`) + botón "Buscar" en el header; navega a cualquier sección visible para
      el usuario (respeta permisos igual que el sidebar), con filtro por texto y
      navegación por teclado (flechas + Enter).
      **Bug real encontrado y corregido de paso:** `AppLayout.tsx` seguía importando
      `adminNavItem` (nombre viejo, singular) de `nav-data.ts`, renombrado a
      `adminNavItems` (plural, arreglo) durante el punto 4 — nunca se actualizó ese
      import. El breadcrumb del header quedaba en blanco en `/permisos` y `/usuarios`
      porque `allItems` terminaba con un `undefined` en vez de esas dos entradas. Pasó
      desapercibido en items 4–10 porque `npx tsc --noEmit` (el comando que estuve usando
      para "verificar tipos" en cada paso) es un no-op silencioso en este proyecto: la
      `tsconfig.json` raíz es de solo-referencias (`"files": []`) y sin `-b` no compila
      nada. El comando correcto es `npx tsc -b --noEmit` — con eso el error apareció de
      inmediato (TS2724). Anotado en memoria para no repetirlo. Corregido y verificado
      con `tsc -b --noEmit` limpio.

## Ronda 5 — feedback del 2026-08-21 (base de datos + diseño)

Pedido del usuario: mejorar rendimiento/integridad de la BD (mencionó explícitamente
normalización — "tercera norma" — y que todo quede registrado/auditado), respaldos, y
mejorar estética + responsive del frontend. Auditoría previa (2 agentes Explore en
paralelo) antes de planear — hallazgos y plan completo en la conversación con el
usuario. Decisiones confirmadas: diseño = pulido + responsive sobre la paleta/tipografía
actual (no rediseño de fondo, el sistema de diseño ya es coherente); `SECCIONES` se
queda como enum de código (no pasa a tabla — cada sección nueva requiere código nuevo
de todas formas). Mismo criterio de siempre: cada punto completo (migraciones, `npm
test`, curl contra la BD real, sin dejar datos de prueba) antes de seguir.

- [x] **R5.1. Normalizar `Usuario.rol`/`RolPermiso.rol` a FK real (`Rol.id`)** — eran
      strings libres que solo se mantenían consistentes por convención de código
      (`roles.controller.js` propagaba renombres a mano con `updateMany` sobre
      `Usuario`/`RolPermiso`); nada en la BD lo garantizaba. Ahora `Usuario.rolId` y
      `RolPermiso.rolId` son FK reales hacia `Rol.id` (`@@index([rolId])` en ambas,
      `@@unique([rolId, seccion])` en `RolPermiso` reemplaza el viejo
      `@@unique([rol, seccion])`; `RolPermiso.rolId` con `onDelete: Cascade` — al
      borrar un rol de verdad sus permisos van con él; `Usuario.rolId` sin cascade,
      protegido por el chequeo "en uso" que ya existía en `roles.controller.js`).
      Migración manual `20260821020000_rol_fk` (mismo patrón de backfill dinámico que
      `20260821002045_roles`: por si acaso algún valor de `rol` no tuviera fila en
      `roles` — no debería pasar, pero cubre drift — se crea antes de hacer el join de
      backfill), aplicada a `inventario_db` y `inventario_test`.
      **Diseño clave: el contrato de la API no cambió** — requests/responses siguen
      usando `rol` como el nombre (string) en todos lados; solo cambió cómo se persiste
      internamente, así que el frontend no necesitó ningún cambio. `lib/permisos.js`
      (`tienePermiso`/`permisosDeRol`) resuelve `Rol` por nombre y consulta por `rolId`;
      `auth.controller.js` incluye la relación `rol` al leer `Usuario` y firma/devuelve
      `usuario.rol.nombre`; `usuarios.controller.js` resuelve `rolId` desde el nombre
      recibido (`resolverRol`); `permisos.controller.js` resuelve `rolId` por rol antes
      de cada `upsert`. **`roles.controller.js` se simplificó de verdad**: `actualizar`
      (rename) ya no necesita el `updateMany` manual — renombrar el `Rol` se refleja
      solo en todo lo que lo referencia por ser FK real, que era justamente el riesgo de
      integridad que esto resuelve; `eliminar`'s chequeo "en uso" pasa de comparar por
      nombre a `findFirst({where:{rolId}})`.
      `prisma/seed.js` actualizado (creaba usuarios con `rol` string directo).
      Tests: `tests/helpers.js` — `crearUsuario` resuelve/crea el `Rol` (upsert por
      nombre) y usa `rolId`; `crearRolesBase` ganó `skipDuplicates: true` (ahora puede
      correr después de `crearUsuario`, que ya crea los roles que usa);
      **`resetDb()` se reordenó** — antes borraba `rol.deleteMany()` antes que
      `usuario.deleteMany()`, lo que ahora violaría la FK (`Usuario.rolId` sin cascade);
      pasa a borrar `usuario` antes que `rol`. `roles.test.js` y dos tests sueltos en
      `bodegas.test.js`/`listasPrecio.test.js` que creaban `RolPermiso` directo con
      `rol: "cajero"` se actualizaron a `rolId`. 44/44 tests verdes.
      Probado end-to-end con curl contra la BD real: crear rol → crear usuario con ese
      rol → cambiar sus permisos → login y confirmar el permiso bloqueado (403 en un
      endpoint gateado) → **renombrar el rol y confirmar que el usuario ve el nuevo
      nombre de inmediato sin ningún código de propagación** → limpiar usuario/rol de
      prueba. Verificación final de integridad: los 2 usuarios reales
      (`admin@inventario.local`/`cajero@inventario.local`) y la configuración de
      permisos real del rol cajero (7 secciones restringidas, configurada por el
      usuario en una ronda anterior) quedaron exactamente igual que antes.

- [x] **R5.2. Registro de auditoría administrativa** — tabla nueva `RegistroAuditoria`
      (migración pura-aditiva `20260821030000_registro_auditoria`, aplicada a
      `inventario_db` y `inventario_test`): `accion`, `usuarioId` (quién ejecutó,
      nullable), `usuarioAfectadoId` (sobre quién, nullable), `valorAnterior`/
      `valorNuevo` (strings simples, sin JSON — mismo espíritu de normalización que
      R5.1), `detalle`, `fecha`; índices en `usuarioId`/`accion`/`fecha`. Es una tabla
      **consolidada** (no una por evento) a propósito: cubre eventos administrativos/
      seguridad de bajo volumen que no tenían ningún rastro — los eventos de alto
      volumen del negocio (ventas, stock, caja, precio base) ya tenían tabla dedicada
      desde antes y no se tocaron. Helper `lib/auditoria.js`
      (`registrarAuditoria(cliente, {...})`, acepta `prisma` o una `tx` en curso) para
      no repetir el `create` en cada controller. Eventos cubiertos: `auth.controller.js`
      `login` (éxito, correo no registrado, contraseña incorrecta, cuenta desactivada —
      los 3 casos de fallo, cada uno con su propio `detalle`); `usuarios.controller.js`
      `actualizar` (cambio de `rol` con antes/después, cambio de `activo`) y
      `resetPassword`; `permisos.controller.js` `actualizar` (una entrada por cada
      `RolPermiso` que realmente cambió de valor, comparando contra el valor previo —
      sin fila = `true` por defecto, igual que `tienePermiso`); `roles.controller.js`
      `actualizar` (rename, con nombre antes/después). `GET /api/auditoria`
      (`requireAdmin`, filtro de rango reutilizando `resolverRango` de
      `lib/rangoFechas.js`, tope de 500 filas). Frontend: `AuditoriaPage.tsx` (solo
      admin, nav junto a Permisos) con `RangoFechasSelector` y tabla
      evento/usuario/afectado/antes→después/detalle, badge distinto para eventos
      fallidos. `tests/auditoria.test.js` nuevo (5 tests: gate de admin, login exitoso
      y fallido quedan registrados, cambio de rol con antes/después, reset de
      contraseña) — 49/49 tests verdes. Probado con curl contra la BD real: login
      fallido y exitoso aparecen en `/api/auditoria`, gate 403 para un cajero.

- [x] **R5.3. Lista de precios — borrado consistente + historial de precios** —
      `listasPrecio.controller.js` `eliminar()` hacía `delete()` incondicional, sin el
      guardia "en uso → desactivar" que sí tienen Categoría/Unidad/Rol/Tipo de Turno;
      ahora revisa si la lista tiene `PrecioLista` **o** `HistorialPrecioLista` (una
      lista que tuvo overrides y se le quitaron todos igual conserva su historial, así
      que también cuenta como "en uso" — si no, se perdería esa historia en silencio al
      borrar). Solo una lista que nunca se tocó se borra de verdad (y ese caso sí queda
      en `RegistroAuditoria` como `lista_precio_eliminada`, ver R5.2).
      Tabla nueva `HistorialPrecioLista` (mismo patrón que `HistorialPrecio` para el
      precio base): `listaPrecioId`, `productoId`, `precioAnterior`/`precioNuevo`
      (nullable — `null` en anterior = no tenía override antes, `null` en nuevo = se
      quitó el override), `usuarioId`, `fecha`. Migración pura-aditiva
      `20260821040000_historial_precios_lista`, aplicada a `inventario_db` y
      `inventario_test`. Se escribe desde `guardarPrecio` (dentro de la misma
      transacción del upsert, leyendo el valor previo antes de escribir) y
      `quitarPrecio` (transacción: borra el override + escribe la fila de historial con
      `precioNuevo: null`). Nuevo `GET /api/listas-precio/:id/precios/:productoId/historial`.
      Frontend: `ListasPrecioPage.tsx` — `eliminar()` maneja la respuesta
      `_desactivado` igual que `RolManager`; ícono de historial junto a cada precio abre
      un diálogo con la línea de tiempo de cambios (fecha, usuario, anterior → nuevo).
      4 tests nuevos en `listasPrecio.test.js` (borra de verdad si nunca se usó, desactiva
      si tiene precios, desactiva si tuvo precios y ya no tiene ninguno pero conserva
      historial, el historial registra cada cambio en orden) — 53/53 tests verdes.
      Probado con curl contra la BD real: fijar precio → cambiar → eliminar lista (con
      precio) → desactiva; quitar el override → eliminar de nuevo → sigue desactivando
      (no pierde el historial); historial muestra los 3 eventos en orden correcto —
      lista de prueba limpiada al terminar.

- [x] **R5.4. Índice faltante en `Venta.usuarioId`** — se usa en
      `consultas.controller.js` `ventasPorUsuario` (agrupa ventas por usuario) y no
      tenía `@@index`. Migración pura-aditiva `20260821050000_venta_usuario_index`,
      aplicada a `inventario_db` y `inventario_test`. `npm test` verde (53/53);
      verificado con `pg_indexes` contra la BD real que `ventas_usuarioId_idx` existe.

- [x] **R5.5. Respaldos de base de datos** — `backend/scripts/backup-db.sh`
      (`pg_dump --format=custom`, nombrado con fecha/hora en `backend/backups/`
      gitignored, borra dumps con más de `RETENCION_DIAS` días — default 30). Sección
      nueva en `DEPLOY.md`: cómo correrlo, cómo restaurar (`pg_restore --clean
      --if-exists`), cómo programarlo (cron en Linux / Task Scheduler en Windows), y la
      nota de que un backup nunca probado no es un backup. No hay servidor de
      producción todavía (confirmado en `DEPLOY.md`), así que queda listo para cuando
      se despliegue, no como un cron ya activo. Probado de verdad contra
      `inventario_test` (nunca `inventario_db`): generó el dump, se restauró con
      `pg_restore` sobre la misma BD de prueba, y `npm test` siguió en 53/53 después —
      confirma que el dump es válido y restaurable de punta a punta. Dump de prueba
      borrado al terminar.

- [x] **R5.6. Diseño — responsive + pulido de consistencia** — pulido sobre la paleta/
      tipografía/dark-mode actual (confirmado con el usuario: no rediseño de fondo, el
      sistema de diseño ya era coherente). Barras de filtros/acciones sin `flex-wrap`
      que se recortaban en pantallas angostas, corregidas en `CajaPage.tsx` (header de
      turno + botones "En espera"/"Retiro-Ingreso"/"Cerrar turno"), `ProductosPage.tsx`,
      `ClientesPage.tsx`, `ProveedoresPage.tsx` y `StockPage.tsx` (barra de
      búsqueda + botones, con `min-w-[200px]` en el input para que envuelva entero en
      vez de aplastarse), `BodegasPage.tsx` (header de la tarjeta de stock + botón
      "Transferir stock"), y `ui/tabs.tsx`/`ConsultasPage.tsx` (`TabsList` con 5
      pestañas se salía del viewport en móvil — ganó `flex-wrap` para acomodarse en más
      de una fila). `DashboardPage.tsx`: grid de KPIs ganó paso intermedio
      (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5`, antes saltaba directo de 2 a 5
      columnas). Revisadas y descartadas por no necesitar cambio: los inputs de
      descuento/vuelto de Caja y el grid de métodos de pago (son proporcionales,
      escalan bien); `TurnosPage.tsx`/`MovimientosPage.tsx`/`ListasPrecioPage.tsx` (ya
      sin barras de acciones que se recorten). Pulido de consistencia: verificado (no
      hacía falta tocar nada) que el estado vacío (`text-center py-10
      text-muted-foreground`) ya es idéntico en las 12 páginas que lo usan, y que el
      hover de fila ya está centralizado en `ui/table.tsx` (`TableRow`) — el sistema de
      diseño ya era consistente, como había anticipado la auditoría inicial.
      `npx tsc -b --noEmit` y `npx vite build` limpios.

**Estado: Ronda 5 completa (6/6) — cerrada el 2026-08-21.**

## Reorganización de navegación — feedback del 2026-08-21

Pedido del usuario: "seccionar las cosas" del sidebar en Mantención (creación/edición),
Consultas (detalle, stocks, etc.) y Admin (roles, permisos, etc.). `nav-data.ts`
(`navGroups`) pasó de "General/Inventario/Contactos" a:
- **General**: Dashboard, Caja, Turnos (operación diaria).
- **Consultas**: Historial, Stock, Reportes (antes "/consultas" se llamaba "Consultas"
  en el sidebar — se renombró a "Reportes" dentro del grupo para no repetir el nombre
  del grupo en el breadcrumb; la sección de permisos sigue llamándose "consultas"
  internamente, no cambió).
- **Mantención**: Productos, Precios, Listas de precios, Clientes, Proveedores, Bodega
  (movimientos), Bodegas (catálogo) — todas las páginas de creación/edición de datos
  maestros gateadas por `requireSeccion`.
El bloque **Administración** (Usuarios, Roles, Permisos, Auditoría) ya existía separado
en `AppSidebarNav.tsx` (solo visible para admin) y ya coincidía con lo pedido — no se
tocó. Ningún guard de permisos cambió (`RequireSeccion`/`RequireAdmin` en `App.tsx`
intactos), es solo reorganización visual del menú. `npx tsc -b --noEmit` y
`npx vite build` limpios.

**Ajuste siguiente (mismo día):** dos pedidos más — mover **Categorías** a Mantención,
y renombrar la página de entradas/salidas porque se llamaba igual ("Bodega") que el
catálogo de bodegas nuevo.
- `/bodega` (entradas/salidas manuales de stock) pasó a llamarse **"Entradas y
  salidas"** en el sidebar — el `to`/la ruta no cambiaron, solo el label.
- **Categorías** sigue gateada por `RequireAdmin` (no se le dio un permiso de sección
  editable — solo se pidió reubicarla, no abrirle el acceso a otros roles), así que no
  podía simplemente sumarse a `navGroups` (eso se filtra por permiso de sección, no por
  rol, y le mostraría el link a cualquiera con acceso a "productos" aunque la ruta lo
  siguiera bloqueando). Se sacó de `adminNavItems` y pasó a exportarse sola como
  `categoriasNavItem` en `nav-data.ts`; `AppSidebarNav.tsx` la inserta al final del
  grupo "Mantención" **solo cuando el usuario es admin** (mismo resultado visual que
  pedía el usuario, sin tocar el control de acceso). `AppLayout.tsx` (breadcrumb) y
  `CommandPalette.tsx` (Ctrl+K) también se actualizaron para seguir reconociendo
  `/categorias` ahora que salió de `adminNavItems`. `npx tsc -b --noEmit` y
  `npx vite build` limpios.

## Ronda 6 — Seguridad de login + reportes con márgenes

Pedido del usuario (23-08-2026 aprox., sesión siguiente a la Ronda 5): "qué podemos
mejorar o agregar al proyecto?". Se ofrecieron 4 direcciones (desplegar a producción,
seguridad de login, reportes/exportación, notificaciones); el usuario eligió **seguridad
de login** y **reportes y exportación** (despliegue a producción queda para más
adelante), con exportación en **CSV** y **sí** incluir gráficos de margen/ganancia por
producto.

- [x] **R6.1. Bloqueo de cuenta tras intentos fallidos de login** — el sistema ya tenía
      rate limiting por IP en `/api/auth/login` (`loginLimiter`, 10 intentos/15min,
      de una ronda anterior) pero nada protegía una cuenta puntual si el ataque venía
      repartido entre varias IPs. `auth.controller.js` `login()` ahora cuenta, antes de
      comparar la contraseña, cuántos `RegistroAuditoria` con `accion: "login_fallido"`,
      `usuarioAfectadoId` de ese usuario y `detalle: "contraseña incorrecta"` hay en los
      últimos 15 minutos (`LOCKOUT_VENTANA_MIN`); con 5 o más (`LOCKOUT_INTENTOS`)
      rechaza el intento con 429 **sin comparar la contraseña**, incluso si es correcta,
      y registra un nuevo evento `login_bloqueado` (distinto de `login_fallido`, para
      que en Auditoría se distinga un intento con contraseña mala de un intento
      rebotado por el bloqueo). **Sin tabla ni columna nueva** — se apoya por completo en
      `RegistroAuditoria` (R5.2): el bloqueo se levanta solo cuando los intentos salen
      de la ventana de 15 minutos, no hay estado que resetear a mano. Tests nuevos:
      `authLockout.test.js` (5 fallos seguidos de un 6to intento con la contraseña
      correcta → 429) y `authLockoutAislado.test.js` (bloquear una cuenta no afecta a
      otra) — **separados en dos archivos a propósito**: cada archivo de Jest reinicia
      el store en memoria del rate limiter de IP, pero los tests dentro de un mismo
      archivo lo comparten, así que juntar ambos escenarios en un archivo acumulaba
      intentos suficientes para disparar el límite de IP (10/15min) en vez del de
      cuenta que se quería probar. 57/57 tests verdes. Probado con curl contra la BD
      real: usuario de prueba creado vía `POST /api/usuarios`, 5 logins con contraseña
      mala (401 cada uno), 6to intento con la contraseña correcta → 429 con el mensaje
      de bloqueo; confirmado en `RegistroAuditoria` que quedaron 6 filas (5
      `login_fallido` + 1 `login_bloqueado`); usuario y filas de auditoría de prueba
      eliminados directo por Prisma al terminar (no existe `DELETE /api/usuarios/:id`
      en la API — los usuarios reales se desactivan, no se borran; este sí se borró por
      ser enteramente de prueba).

- [x] **R6.2. Reportes — exportación CSV y márgenes por producto** — la exportación CSV
      ya existía en Historial/Stock/Turnos (`lib/exportCsv.ts`, con BOM para que Excel
      detecte UTF-8 correctamente); lo que faltaba era en los 3 reportes de
      `ConsultasPage.tsx` que no la tenían (Productos más vendidos, Ventas por usuario,
      Ventas por forma de pago) — cada uno ganó un botón "Exportar CSV" junto al
      selector de rango, reusando `exportarCsv()`, deshabilitado sin datos.
      Nuevo reporte **Márgenes por producto**: `consultas.controller.js`
      `productosMargen()` (`GET /api/consultas/productos-margen`) agrupa `VentaItem`
      por producto en el rango (excluyendo cortesías, igual que `productosTop`), y
      calcula `ingreso` (suma de subtotal), `costo` (`Producto.precioCompra` **actual**
      × cantidad — documentado en el código y en la UI que no es el costo histórico al
      momento de cada venta, sería necesario cruzar con `HistorialPrecio` por fecha;
      aproximación razonable para un reporte gerencial, no una cifra contable exacta),
      `margen` y `margenPct`, ordenado por margen descendente. Frontend: nueva pestaña
      "Márgenes por producto" en Consultas — **se evaluó agregar `recharts` pero se
      descartó**: el Dashboard ya tiene un patrón propio de gráficos hechos a mano
      (`MagnitudeBarChart`, `SalesLineChart`, sin librería, un solo color —
      `var(--primary)` — sin paleta categórica) y la paleta `--chart-1..5` del tema no
      pasa el validador de contraste categórico del skill de dataviz (colores
      demasiado desaturados para distinguirse por color solo); en vez de introducir una
      paleta nueva que chocara con la identidad visual ya confirmada por el usuario
      ("no rediseño de fondo", Ronda 5), se reusó `MagnitudeBarChart` tal cual —
      barras de magnitud único (el margen en dinero), con ingreso/costo/margen% como
      subtítulo de cada barra, más una tabla debajo con el detalle completo — mismo
      patrón que ya usa el Dashboard, cero dependencias nuevas. `recharts` se instaló y
      se desinstaló en la misma sesión al notar el desajuste, no quedó en
      `package.json`. Tests nuevos `consultas.test.js` (no existía archivo de test para
      este controller): calcula ingreso/costo/margen correctamente a partir del precio
      de compra actual, y excluye ventas de cortesía. 57/57 tests verdes (incluye R6.1).
      `npx tsc -b --noEmit` y `npx vite build` limpios. Probado con curl contra la BD
      real: `GET /api/consultas/productos-margen?dias=90` devuelve 5 productos con
      ingreso/costo/margen coherentes con las ventas sintéticas existentes (ej. Arroz
      1kg: 35 unidades, ingreso $875, costo $630, margen $245 = 28%) — sin datos de
      prueba que limpiar, fue solo lectura.

**Estado: Ronda 6 completa (2/2) — cerrada el 2026-08-22.** Pendiente (explícitamente
pospuesto por el usuario, no descartado): desplegar a producción.

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
