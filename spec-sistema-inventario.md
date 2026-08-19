# Sistema de Inventario + Caja (POS) — Especificación técnica

## Objetivo
Aplicación web para una tienda pequeña: gestión de inventario (productos, stock),
clientes, proveedores, y punto de venta (caja) que descuenta stock automáticamente
al vender.

## Stack sugerido
- **Frontend:** React + Vite + TypeScript, React Router, TailwindCSS
- **Backend:** Node.js + Express (o Next.js con API routes, si se prefiere todo en un solo proyecto)
- **Base de datos:** PostgreSQL
- **ORM:** Prisma (migra el esquema fácil y genera tipos para TS)
- **Auth:** JWT simple con sesión (usuario/contraseña), roles básicos: admin / cajero

## Esquema de base de datos (Prisma-style, ajustar sintaxis exacta después)

```
Producto
  id            String   @id @default(uuid())
  sku           String   @unique
  nombre        String
  categoria     String?
  precioCompra  Decimal
  precioVenta   Decimal
  stock         Int      @default(0)
  stockMinimo   Int      @default(0)
  unidad        String   @default("unidad")
  proveedorId   String?
  proveedor     Proveedor? @relation(fields: [proveedorId], references: [id])
  activo        Boolean  @default(true)
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

Cliente
  id        String  @id @default(uuid())
  nombre    String
  telefono  String?
  email     String?
  direccion String?
  creadoEn  DateTime @default(now())

Proveedor
  id        String  @id @default(uuid())
  nombre    String
  telefono  String?
  email     String?
  contacto  String?
  creadoEn  DateTime @default(now())

Venta
  id           String   @id @default(uuid())
  fecha        DateTime @default(now())
  clienteId    String?
  cliente      Cliente? @relation(fields: [clienteId], references: [id])
  total        Decimal
  metodoPago   String   // efectivo | tarjeta | transferencia
  items        VentaItem[]
  usuarioId    String?

VentaItem
  id            String  @id @default(uuid())
  ventaId       String
  venta         Venta   @relation(fields: [ventaId], references: [id])
  productoId    String
  producto      Producto @relation(fields: [productoId], references: [id])
  cantidad      Int
  precioUnitario Decimal
  subtotal      Decimal

Usuario
  id        String @id @default(uuid())
  nombre    String
  email     String @unique
  password  String  // hash
  rol       String  // admin | cajero
```

## Módulos / Funcionalidades

### 1. Productos (CRUD)
- Listar, buscar por nombre/sku/categoría, filtrar por stock bajo
- Crear/editar/eliminar (eliminar = desactivar, no borrar físico si ya tiene ventas)
- Alerta visual cuando `stock <= stockMinimo`

### 2. Clientes (CRUD)
- Listar, buscar, crear/editar/eliminar
- Historial de compras por cliente (join con Venta)

### 3. Proveedores (CRUD)
- Listar, buscar, crear/editar/eliminar
- Ver productos asociados a cada proveedor

### 4. Caja / Punto de venta
- Buscar producto por nombre/sku, agregarlo al ticket
- Editar cantidad, quitar ítems
- Seleccionar cliente (opcional, puede ser venta genérica)
- Calcular total en tiempo real
- Al cobrar: crear Venta + VentaItems, descontar stock de cada Producto (transacción atómica)
- Seleccionar método de pago
- Opción de imprimir/exportar ticket

### 5. Historial de ventas
- Listado con filtro por fecha, cliente, método de pago
- Detalle de cada venta (items, totales)

## Endpoints API sugeridos (REST)
```
GET/POST         /api/productos
GET/PUT/DELETE   /api/productos/:id

GET/POST         /api/clientes
GET/PUT/DELETE   /api/clientes/:id

GET/POST         /api/proveedores
GET/PUT/DELETE   /api/proveedores/:id

GET/POST         /api/ventas         (POST = crear venta, descuenta stock)
GET              /api/ventas/:id

POST             /api/auth/login
```

## Reglas de negocio clave
- No permitir vender más cantidad de la que hay en stock.
- El descuento de stock y la creación de la venta deben ir en una sola transacción de DB.
- SKU de producto debe ser único.
- Los totales se calculan en el backend (nunca confiar en el total que manda el frontend).

## Notas de UI/layout (validadas en mockup)
- Navegación como **barra lateral vertical fija** en escritorio (Caja, Productos, Clientes,
  Proveedores, Historial), colapsando a tabs horizontales en móvil.
- Contenido con ancho cómodo, ni pegado a los bordes ni pantalla completa (~max 1152px,
  padding generoso, tarjetas con buen espaciado interno — no apretado).
- Caja: buscador de producto + grid de productos rápidos a la izquierda, ticket de venta
  estilo recibo (fondo oscuro, tipografía monoespaciada, línea punteada, total destacado)
  a la derecha.
- Ver `inventario-pos.jsx` (mockup ya construido) como referencia visual y de interacción
  para replicar el mismo look & feel en la versión real.

## Setup de base de datos local
- Requiere PostgreSQL corriendo localmente (nativo o vía Docker) antes de correr migraciones.
- Como parte del setup inicial, verificar si Postgres está instalado/corriendo; si no,
  ofrecer instalarlo o levantar un contenedor Docker (`docker run --name inventario-db
  -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`).
- Crear la base de datos (`createdb inventario_db` o equivalente).
- Generar `.env` con `DATABASE_URL="postgresql://usuario:password@localhost:5432/inventario_db"`.
- Correr `npx prisma migrate dev` para aplicar el schema inicial.

## Estructura de carpetas sugerida
```
/inventario-app
  /backend
    /prisma (schema.prisma, migrations)
    /src
      /routes
      /controllers
      /middleware (auth)
  /frontend
    /src
      /pages (Caja, Productos, Clientes, Proveedores, Historial)
      /components
      /api (cliente HTTP)
```

## Primer prompt sugerido para Claude Code
"Lee este archivo de especificación (spec-sistema-inventario.md) e inicializa el
proyecto: backend con Node/Express/Prisma/PostgreSQL y frontend con React/Vite/Tailwind.
Empieza por el schema de Prisma y las migraciones, luego los endpoints de Productos,
y después el frontend del módulo Productos con su CRUD completo."
