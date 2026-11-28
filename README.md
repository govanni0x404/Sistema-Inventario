# Kardexia

Sistema de punto de venta e inventario en pesos chilenos. Permite abrir y cerrar turnos, combinar medios de pago, guardar ventas en espera y registrar devoluciones. Gestiona órdenes de compra, recepciones parciales y devoluciones a proveedores. Mantiene stock por bodega, mínimos de reposición, valorización al costo de catálogo y un kárdex exportable.

## Desarrollo local

Necesitas Node.js 22.12 o posterior y una base PostgreSQL vacía con un usuario autorizado para crear tablas. Ejecuta estos comandos desde la raíz del repositorio.

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

Copia `backend/.env.example` a `backend/.env` y define `DATABASE_URL` y `JWT_SECRET`. Ejecuta estos comandos desde `backend/`.

```sh
npx prisma migrate deploy
npm run dev
```

En otra terminal, desde la raíz, ejecuta `npm run dev --prefix frontend`. Abre `http://localhost:5173` y completa el asistente para crear el negocio y su primera cuenta de administrador.

### Arranque en PowerShell

Con las dependencias y la base configuradas, abre dos terminales en la raíz del proyecto. Ejecuta `npm.cmd start --prefix backend` en la primera y `npm.cmd start --prefix frontend` en la segunda. `npm.cmd` funciona también cuando PowerShell bloquea `npm.ps1`. El backend ejecuta JavaScript directamente. Para compilar el frontend, usa `npm.cmd run build --prefix frontend`.

Si usas la instancia de prueba de PostgreSQL 17 guardada en `backend/.postgres-local/data` y reinicias Windows, arráncala desde la raíz antes de abrir la aplicación.

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D 'backend/.postgres-local/data' -l 'backend/.postgres-local/servidor.log' start
```

## Verificación local

Crea una base PostgreSQL separada cuyo nombre termine en `_test`, por ejemplo `inventario_test`. Desde `backend/`, ejecuta `npx prisma migrate deploy` con `DATABASE_URL` apuntando a esa base. Después, configura la misma URL en `TEST_DATABASE_URL` o como `DATABASE_URL` en `backend/.env.test`.

```sh
npm test --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Las pruebas del backend vacían las tablas de la base de pruebas entre casos.

## Integridad de datos

Las cotizaciones y las tomas de inventario tienen una cabecera y una tabla de líneas. El total de la cotización y el resumen del conteo se calculan a partir de esas líneas. Los nombres, códigos y precios históricos quedan en el documento y se pueden consultar tras eliminar un producto del catálogo.

Las existencias por bodega son la fuente para el saldo total del producto. Las recepciones determinan cuántas unidades se han recibido en una compra. La referencia a la recepción original identifica las devoluciones a proveedor. Caja calcula el subtotal y la diferencia de arqueo con los importes registrados. La fecha de cierre determina el estado del turno.

### Revisión de claves y dependencias

| Área | Claves y dependencias revisadas |
| --- | --- |
| Catálogos | Productos por identidad, SKU y código de barras cuando existe. Nombre único en categorías, unidades, bodegas, listas, cajas, tipos de turno y roles. Clientes y proveedores por ID. La foto del producto usa el ID de la ficha. |
| Inventario | Existencias por producto y bodega. Movimientos por ID. Tomas por ID y líneas por posición o por producto dentro de la toma. Los historiales de precio registran cambios por evento. |
| Compras | Órdenes por ID o folio y líneas por orden y producto. Operaciones por ID y cantidades por operación y línea. |
| Caja y ventas | Turnos y movimientos de caja por ID. Ventas por ID y cotización enlazada cuando existe. Pagos por venta y método. Las líneas de venta tienen ID propio y las devoluciones identifican cada línea devuelta dentro de un documento. Los carritos en espera tienen su propio detalle. |
| Cotizaciones | Documentos por ID o folio y líneas por posición. Cotizaciones y conteos apuntan a una identidad de producto que sigue disponible cuando se elimina la ficha. |
| Accesos y configuración | Usuarios por ID o correo. Permisos por rol y sección. Auditoría por evento. Configuración general por la clave de la instalación. |

Los nombres y costos capturados en los documentos pertenecen al momento de la operación. El total cobrado y el monto esperado al cerrar un turno se guardan como evidencia histórica. Los movimientos conservan su bodega y su saldo resultante para consultar el kárdex junto con documentos antiguos.

## Operación

- [Manual de uso](MANUAL.md) para configurar el negocio, vender y administrar el inventario.
- [Despliegue y respaldos](DEPLOY.md) para servir la aplicación compilada y configurar PostgreSQL, HTTPS y monitoreo.
