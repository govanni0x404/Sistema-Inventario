# Caja e Inventario

Sistema de punto de venta e inventario en pesos chilenos. Permite abrir y cerrar turnos, cobrar con hasta dos medios de pago, guardar ventas en espera y registrar devoluciones. Mantiene stock por bodega y un historial de movimientos, con catálogos, listas de precios, usuarios, permisos y reportes exportables.

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

## Operación

- [Manual de uso](MANUAL.md) para configurar el negocio, vender y administrar el inventario.
- [Despliegue y respaldos](DEPLOY.md) para servir la aplicación compilada y configurar PostgreSQL, HTTPS y monitoreo.
