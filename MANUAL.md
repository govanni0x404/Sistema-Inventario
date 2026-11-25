# Manual de uso de Kardexia

Guía rápida para el dueño del negocio y los cajeros.

---

## 1. Primer día: configurar el sistema

La primera vez, escribe tu correo y una clave de al menos ocho caracteres. Pulsa **Crear cuenta e ingresar** para crear la primera cuenta de administrador. Si quien instaló el sistema habilitó una clave de instalación, también deberás ingresarla.

En los siguientes accesos usa tu correo y tu clave. Si olvidas la clave, pulsa **¿Olvidaste tu clave?** para solicitar ayuda. Un administrador puede revisar la solicitud en **Auditoría**, verificar tu identidad y restablecer la clave desde **Usuarios**.

> Esta pantalla aparece **una sola vez**. Después, todos entran por la pantalla de inicio de sesión.

Luego, en este orden:

1. **Herramientas → Configuración**: revisa los datos del negocio, el mensaje del comprobante y las opciones de Caja.
2. **Herramientas → Usuarios**: crea una cuenta para cada cajero (rol **cajero**).
3. **Mantención → Productos**: agrega productos con **Nuevo producto** y haz clic en cualquier fila para editarla.

---

## 2. Vender (Caja)

1. Entra a **Caja**. Verás la empresa y la fecha local del equipo. Elige una caja y un tipo de turno, ingresa el **fondo fijo de apertura** y pulsa **Abrir caja**. Escribe **0** si abres sin efectivo. Si esa caja ya está abierta, puedes continuar su turno.
2. Busca el producto por nombre o código. Usa **↑ / ↓** y **Enter** para elegir un resultado, o escanea el código.
3. Ajusta cantidades con **+ / −** y aplica descuentos por monto o porcentaje según el máximo configurado. Puedes cambiar el cliente y el documento antes de cobrar.
4. Elige una forma de pago, indica el monto y pulsa **Agregar al pago**. Repite hasta cubrir el saldo. Para una **Cortesía**, selecciona ese medio e indica el motivo.
5. Si pagan en efectivo, indica el **Efectivo recibido** o pulsa **Pago exacto**. La pantalla muestra el **vuelto**.
6. Presiona **Cobrar**. La confirmación muestra el folio interno, las formas de pago y el vuelto si corresponde. Pulsa **Imprimir comprobante** o **Nueva venta**.

> El comprobante del sistema es un documento de uso interno.

**Otras opciones en Caja**

- **Herramientas → Control de cajas**: un administrador puede crear cajas, cambiar sus nombres y editar su disponibilidad. Cada caja puede tener un turno abierto.
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

Puedes ver todos los turnos cerrados en **Mantención → Turnos**.

---

## 4. Devoluciones

1. Ve a **Consultas → Historial de ventas** y abre la venta. El detalle contiene el botón para reimprimir su comprobante.
2. Presiona **Devolver** e indica cuántas unidades devuelve el cliente.
3. El sistema calcula **cuánto devolver** (lo que el cliente realmente pagó, con descuentos incluidos) y vuelve a sumar el stock.
4. Si la venta se pagó con dos formas de pago, elige **cómo devuelves el dinero**.
5. Imprime la **nota de crédito interna** de la devolución registrada. Puedes volver a abrir la venta para reimprimirla.

> Para devolver **efectivo** debe haber un turno abierto: ese dinero sale de la caja y se descuenta en el cierre.

---

## 5. Inventario

- **Inventario → Stock**: cuánto tienes de cada producto. Filtra por **stock bajo** para saber qué comprar.
- **Inventario → Entradas y salidas**: registra mercadería que llega (entrada) o que se pierde o vence (salida).
- **Inventario → Bodegas**: si tienes más de una bodega, mueve stock entre ellas con **Transferir**. La Caja muestra las unidades disponibles para vender en la **Bodega Principal**.
- **Inventario → Toma y ajuste de stock**: elige la bodega, selecciona **Toma de inventario** y anota el conteo físico por producto. Revisa la diferencia, escribe un motivo y guarda. Para corregir un solo producto, selecciona **Ajuste de stock**. El historial conserva quién hizo el cambio, el motivo y las cantidades anteriores y nuevas. Si las existencias cambiaron durante el conteo, actualiza el stock y revisa las cantidades antes de volver a guardar.
- **Mantención → Precios**: cambia precios de compra y venta (queda un historial de cada cambio).

---

## 6. Reportes

- **Dashboard**: ventas de hoy, ticket promedio, productos más vendidos y stock bajo.
- **Consultas → Reportes**: productos más vendidos, ventas por forma de pago, ventas por cajero y **margen por producto**. Todos se pueden **descargar en CSV** (se abre con Excel).
- **Detalle de venta**: busca el folio de un comprobante para revisar la venta, sus pagos y sus devoluciones.
- **Detalle de pagos**: filtra por período, folio o medio de pago. Los cobros aparecen como montos positivos y los reembolsos como montos negativos, en la fecha de cada operación.
- **Detalle de productos**: busca por nombre o código de barras para revisar cantidades vendidas y devueltas por comprobante. Los detalles de pagos y productos se pueden descargar en CSV. Si el filtro supera las 1.000 filas, reduce el período para obtener una exportación completa.
- **Margen por producto**: toma el importe cobrado con descuentos y antes de devoluciones. Usa el costo registrado al vender. Para los tickets antiguos sin ese dato, el sistema indica cuándo usa el costo actual como estimación.

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
