# Manual de uso — Caja e Inventario

Guía rápida para el dueño del negocio y los cajeros.

---

## 1. Primer día: configurar el sistema

La primera vez que abres el sistema aparece la pantalla **"Bienvenido"**:

1. Escribe el **nombre de tu negocio** (y si quieres, RUT, dirección y teléfono: salen en el comprobante).
2. Crea **tu cuenta de administrador**: tu nombre, tu correo y una contraseña de al menos 8 caracteres.
3. Presiona **Comenzar**. Quedas dentro del sistema como administrador.

> Esta pantalla aparece **una sola vez**. Después, todos entran por la pantalla de inicio de sesión.

Luego, en este orden:

1. **Administración → Datos del negocio**: revisa los datos y el mensaje al pie del comprobante (ej. horario o política de cambios).
2. **Administración → Usuarios**: crea una cuenta para cada cajero (rol **cajero**).
3. **Mantención → Productos**: agrega tus productos uno por uno o **impórtalos desde un archivo CSV/Excel** con el botón *Importar*.

---

## 2. Vender (Caja)

1. Entra a **Caja**. Si no hay un turno abierto, elige el tipo de turno, escribe el **fondo inicial** (el sencillo con que partes) y presiona **Abrir turno**.
2. Busca el producto por nombre o código, o **escanéalo con el lector de código de barras**.
3. Ajusta cantidades con **+ / −**. Puedes poner un descuento por producto o al total.
4. Elige la **forma de pago**: efectivo, tarjeta o transferencia. Con **Dividir pago** puedes cobrar con dos formas (ej. parte efectivo, parte tarjeta).
5. Si pagan en efectivo, escribe cuánto te entregaron en **Recibe** y el sistema calcula el **vuelto**.
6. Presiona **Cobrar**. Puedes **imprimir el comprobante**.

> **Boleta:** el comprobante del sistema es **interno** (no reemplaza la boleta). La boleta la entrega tu máquina de pago (Mercado Pago, Getnet, banco, etc.).

**Otras opciones en Caja**

- **En espera**: guarda una venta a medias (ej. el cliente fue a buscar algo) y recupérala después.
- **Cortesía**: regala productos sin cobrar (pide un motivo). Descuenta stock pero no cuenta como venta.
- **Lista de precios**: si tienes precios especiales (mayorista, promoción), elige la lista antes de cobrar.
- **Retiro / Ingreso**: saca dinero de la caja (ej. pagar a un proveedor) o agrega sencillo. Siempre pide un motivo.

---

## 3. Cerrar la caja (fin del turno)

1. En **Caja**, presiona **Cerrar turno**.
2. El sistema muestra **cuánto efectivo debería haber**: fondo inicial + ventas en efectivo − devoluciones en efectivo + ingresos − retiros.
3. **Cuenta el dinero** de la caja y escríbelo en *Efectivo contado*.
4. El sistema te dice si hay **faltante** o **sobrante**. Presiona **Cerrar turno**.

Puedes ver todos los turnos cerrados en **General → Turnos**.

---

## 4. Devoluciones

1. Ve a **Consultas → Historial** y abre la venta.
2. Presiona **Devolver** e indica cuántas unidades devuelve el cliente.
3. El sistema calcula **cuánto devolver** (lo que el cliente realmente pagó, con descuentos incluidos) y vuelve a sumar el stock.
4. Si la venta se pagó con dos formas de pago, elige **cómo devuelves el dinero**.

> Para devolver **efectivo** debe haber un turno abierto: ese dinero sale de la caja y se descuenta en el cierre.

---

## 5. Inventario

- **Consultas → Stock**: cuánto tienes de cada producto. Filtra por **stock bajo** para saber qué comprar.
- **Mantención → Entradas y salidas**: registra mercadería que llega (entrada) o que se pierde o vence (salida).
- **Mantención → Bodegas**: si tienes más de una bodega, mueve stock entre ellas con **Transferir**. La Caja siempre vende desde la **Bodega Principal**.
- **Mantención → Precios**: cambia precios de compra y venta (queda un historial de cada cambio).

---

## 6. Reportes

- **Dashboard**: ventas de hoy, ticket promedio, productos más vendidos y stock bajo.
- **Consultas → Reportes**: productos más vendidos, ventas por forma de pago, ventas por cajero y **margen por producto**. Todos se pueden **descargar en CSV** (se abre con Excel).

---

## 7. Usuarios y seguridad

- Cada persona debe tener **su propia cuenta**. Así sabes quién vendió qué.
- **Cambiar tu contraseña**: haz clic en tu nombre (abajo a la izquierda) → **Cambiar contraseña**.
- **Si un cajero se va**: en **Administración → Usuarios**, desactiva su cuenta. Pierde el acceso **de inmediato**.
- **Permisos**: en **Administración → Permisos** decides qué secciones ve cada rol.
- Si alguien se equivoca de contraseña **5 veces**, la cuenta se bloquea 15 minutos.
- **Auditoría** registra inicios de sesión, cambios de permisos y de contraseñas.

---

## Preguntas frecuentes

**El cierre de caja me da faltante, ¿qué reviso?**
Revisa en el detalle del turno los retiros, ingresos y devoluciones en efectivo. Un retiro no registrado es la causa más común.

**Escaneo un producto y dice "Producto no encontrado".**
Ese código de barras no está cargado. Edita el producto en **Productos** y agrega el código.

**No me aparece una sección del menú.**
Tu rol no tiene permiso. Pídele al administrador que lo active en **Permisos**.
