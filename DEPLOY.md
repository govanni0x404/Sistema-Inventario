# Notas de despliegue a producción

Este proyecto se desarrolló y probó en local (`localhost:4000` backend, `localhost:5173`
frontend). Antes de exponerlo fuera de una red local, revisar lo siguiente.

## Variables de entorno (`backend/.env`)

Copiar `backend/.env.example` a `backend/.env` y completar con valores reales — **nunca**
reusar los valores de desarrollo en producción:

- `DATABASE_URL`: cadena de conexión a la base de datos de producción (usuario/contraseña
  propios, no los de desarrollo).
- `JWT_SECRET`: un secreto aleatorio largo, por ejemplo generado con
  `openssl rand -base64 48`. **El backend rechaza arrancar en producción** (`NODE_ENV=production`)
  si `JWT_SECRET` está vacío, es uno de los valores de ejemplo (`change_me`,
  `dev_secret_change_me_in_production`) o mide menos de 32 caracteres — ver
  `backend/src/lib/jwt.js`.
- `CORS_ORIGIN`: el dominio real del frontend (no `http://localhost:5173`).
- `NODE_ENV=production`: además de la validación de `JWT_SECRET` de arriba, habilita
  `trust proxy` en Express (`backend/src/app.js`), necesario para que el rate limiting de
  login identifique la IP real del cliente detrás de un reverse proxy.

## HTTPS

El servidor Express no termina TLS por sí mismo. Ponerlo detrás de un reverse proxy
(nginx, Caddy, o el balanceador del proveedor de hosting) que:
- Termine HTTPS con un certificado válido (Let's Encrypt, etc.).
- Reenvíe las cabeceras `X-Forwarded-*` (nginx: `proxy_set_header X-Forwarded-For`,
  `X-Forwarded-Proto`, etc.) — junto con `NODE_ENV=production` esto hace que el rate
  limiting y cualquier lógica futura basada en IP funcionen correctamente.
- Redirija todo el tráfico HTTP a HTTPS.

El frontend (build estático de Vite) puede servirse desde el mismo proxy o desde
cualquier CDN/hosting estático, apuntando sus llamadas a la API al dominio del backend.

## Rate limiting

`POST /api/auth/login` está limitado a 10 intentos por IP cada 15 minutos (los intentos
exitosos no cuentan contra el límite) — ver `backend/src/routes/auth.routes.js`. Frena
fuerza bruta básica sobre credenciales; no reemplaza medidas adicionales (CAPTCHA, 2FA)
si el sistema llegara a exponerse públicamente en internet.

## Respaldos de la base de datos

`backend/scripts/backup-db.sh` genera un dump comprimido (`pg_dump --format=custom`,
restaurable con `pg_restore`) en `backend/backups/` (gitignored), nombrado con fecha y
hora, y borra los dumps con más de `RETENCION_DIAS` días (default 30):

```bash
DATABASE_URL="postgresql://usuario:pass@host:5432/inventario_db" ./scripts/backup-db.sh
```

Para restaurar (por ejemplo, tras un incidente):

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" backend/backups/inventario_YYYYMMDD_HHMMSS.dump
```

**Programarlo**: en Linux, un cron diario (`crontab -e`):

```
0 3 * * * DATABASE_URL="postgresql://..." /ruta/al/backend/scripts/backup-db.sh >> /var/log/inventario-backup.log 2>&1
```

En Windows, el equivalente es una tarea programada (Task Scheduler) que ejecute el
script vía Git Bash o WSL con las mismas variables de entorno.

**Un backup nunca probado no es un backup**: de vez en cuando (ej. cada vez que se
actualiza el esquema con una migración nueva), restaurar el dump más reciente contra
una base de datos de prueba y correr `npm test`/una revisión manual — así se detecta a
tiempo si el proceso de backup dejó de funcionar, en vez de descubrirlo el día que
realmente se necesita restaurar. Retener backups fuera del mismo servidor de la base de
datos (otro disco, almacenamiento en la nube) — un backup que vive en la misma máquina
no protege contra la falla de esa máquina.

## Migraciones

En producción usar `npx prisma migrate deploy` (aplica migraciones existentes sin
generar nuevas ni pedir confirmación interactiva), nunca `prisma migrate dev`.

## Checklist rápido antes de desplegar

- [ ] `backend/.env` con `JWT_SECRET` real, `DATABASE_URL` de producción, `CORS_ORIGIN`
      correcto y `NODE_ENV=production`.
- [ ] Backend detrás de HTTPS (reverse proxy con `X-Forwarded-*`).
- [ ] `npx prisma migrate deploy` ejecutado contra la base de datos de producción.
- [ ] **No** correr `prisma/seed.js` en producción (crea usuarios de prueba con
      contraseñas conocidas). Una instalación nueva se configura sola: al abrirla por
      primera vez aparece la pantalla **"Bienvenido"** (`/configuracion-inicial`), que crea
      el negocio, la bodega principal, las unidades, los tipos de turno y el primer admin.
- [ ] Definir `SETUP_CLAVE` en `backend/.env` y dársela al cliente: sin ella nadie puede
      completar la configuración inicial (evita que un tercero "reclame" la instalación
      antes que el dueño). La pantalla solo funciona mientras no exista ningún usuario.
