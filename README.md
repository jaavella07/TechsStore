# 🛒 TechsStore — E-Commerce

¿Porque crear este proyecto?

Mi objetivo es desarrollar TechsStore para reforzar lo aprendido en mi camino como Junior, reforzando conceptos y enfrentándome a problemas reales que este desarrollo puede generar, también lograr implementar un asistente que se personalice según lo que el usuario necesite.
Este e-commerce es para aquellas micro-tiendas que hoy en día solo operan de manera física y la primera prueba de fuego será aplicarlo al negocio de mi familia "El Mirador".

Con base en lo anterior cuento con los siguientes repositorios,

1. agent_LangGraph: https://github.com/jaavella07/agent_LangGraph
2. microservices:   https://github.com/jaavella07/microservices
3. bookstore-api:   https://github.com/jaavella07/bookstore-api

Y por lo tanto mantendré documentado mi proceso de desarrollo.

## Decisiones de diseño

---
> Stack: NestJS · TypeORM · PostgreSQL · Redis · BullMQ · Stripe · Langchain · LangGraph
---
> Base de Datos: La BD usada fue Postgres gestionada a través del ORM TypeORM, el cual me ayuda a generar el almacenamiento de usuario,inventario de productos, categorias, ordenes, además del manejo temporal del carrito de compras. También uso Postgres como base de datos para persistir el estado y la memoria del asistente virtual.
---

### 1. Manejo de usuarios 

Tomando el repositorio **bookstore-api** como referencia, realicé la construcción del manejo de autenticación y autorización de usuarios de la siguiente manera:

**Auth - Users (Autenticación - Autorización)**

Estos módulos cuentan con la configuración de registro, acceso, validación, renovación, cambio de estado, autorización y logout.

**JWT** con rotación de refresh tokens:

  - Access Token: **60 min** (corta vida, sin estado)
  - Refresh Token: **7 días** (valor almacenado en BD y hasheado con bcrypt)
  - Al usar un refresh token, se revoca y se emite uno nuevo

**Strategies** para el manejo del JWT

**Guard** protección de rutas bajo los siguientes roles:

  - ADMIN
  - CLIENT

El manejo de usuarios se realiza bajo los siguientes endpoints:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/auth/register`  | Público | Registrar usuario          | 
| POST | `/auth/login`     | Público | Iniciar sesión             |
| POST | `/auth/refresh`   | Público | Renovar access token       |
| POST | `/users/register` | Público | Registrar usuario publico  |
| GET  | `/users`          | ADMIN   | ver listado de usuario     |
| GET  | `/users/:id`      | ADMIN   | ver un usuario por ID      |
|PATCH | `/users/:id/role` | ADMIN   | cambiar rol por ID         |
|DELETE| `/users/:id`      | ADMIN   | Desactivar usuario por ID  |

---

Bajo el repositorio de **microservices** implemente los siguientes modulos, los cuales gestionan uso basico de un e-commerce almacenar productos, contar con un inventario, generar ordenes de compra y manejar un registro de reservas de stock

---

### 2. Productos 

Si bien sabemos los productos son la razón de ser en el desarrollo de un e-commerce y su manejo debe ser ordenado y estructurado, por lo tanto esta sección de la BD cuenta con las siguientes tablas.

Tablas
 - products
 - products-attribute
 - products-image
 - inventory
 - category


El manejo de productos se realiza bajo los siguientes endpoint:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET  | `/products`                      | Público | Listar productos con filtros   |
| GET  | `/products/:id`                  | Público | Listar productos por ID        |
| GET  | `/products/categories`           | Público | Ver detalles del producto      |
| POST | `/products`                      | ADMIN   | Crear producto                 |
|PATCH | `/products/:id`                  | ADMIN   | Actualizar producto            |
|DELETE| `/products/:id`                  | ADMIN   | Desactivar producto por ID     |
| GET  | `/products/:id/inventory`        | ADMIN   | Ver inventario de un producto  |
|PATCH | `/products/:id/inventory/adjust` | ADMIN   | Ajuste manual de stock         |
|POST  | `/products/categories`           | ADMIN   | Crear categoria                |
---

### 3. Carrito

El carrito es el punto de mayor complejidad técnica del flujo de compra. El desafío principal fue resolver el problema del sobrestock: dos usuarios pueden ver el mismo producto disponible, pero solo uno puede comprarlo. Para esto diseñé un sistema de **reserva de inventario en tres fases**.

**Reserva de inventario (tres fases):**
- Al añadir al carrito → `inventory.reservedStock += qty` (bloqueo `SELECT FOR UPDATE`)
- Al expirar el carrito (cron cada 5 min, TTL 30 min) → `reservedStock -= qty`
- Al confirmar el pago (webhook de Stripe) → `totalStock -= qty` y `reservedStock -= qty`

**Snapshot de precio:**
Cada ítem guarda `priceSnapshotInCents` en el momento en que se añade al carrito. Si el precio del producto cambia antes de que el usuario pague, el cliente paga lo que vio, no el precio actualizado.

El carrito requiere token de acceso (CLIENT o ADMIN) y expira a los **30 minutos**. Un job cron lo limpia cada 5 minutos liberando automáticamente las reservas de inventario.

El manejo del carrito se realiza bajo los siguientes endpoints:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET  | `/cart`               | CLIENT | Ver carrito activo  |
| POST | `/cart/items`         | CLIENT | Añadir al carrito   |
|PATCH | `/cart/items/:itemId` | CLIENT | Ajustar cantidad    |
|DELETE| `/cart/items/:itemId` | CLIENT | Liberar reserva     |


---
### 4. Ordenes

Las órdenes se generan a partir de un carrito activo. La decisión clave aquí fue capturar el precio en el momento exacto de la compra: al crear la orden, cada `CartItem.priceSnapshotInCents` se copia como `OrderItem.unitPriceInCents` y ya no cambia. Así el historial de compras siempre refleja lo que el cliente pagó, sin importar si el producto sube o baja de precio después. También almaceno `productNameSnapshot` para que el historial no se rompa si el producto es renombrado o desactivado.

**Formato de número de orden:**
Cada orden recibe un número legible en formato `ORD-YYYYMMDD-XXXX` (ej. `ORD-20240122-A3K9`), útil para soporte al cliente y rastreo de envíos.

**Estados de la orden:**
- `PENDING` → recién creada, esperando pago
- `PAID` → confirmada por webhook de Stripe
- `PROCESSING` → en preparación
- `SHIPPED` → despachada
- `DELIVERED` → entregada
- `CANCELLED` → cancelada
- `REFUNDED` → reembolsada

El manejo de órdenes se realiza bajo los siguientes endpoints:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET  | `/orders/me`         | CLIENT | Mis órdenes                 |
| POST | `/orders`            | CLIENT | Crear orden desde carrito   |
|PATCH | `/orders/:id/status` | ADMIN  | Actualizar estado de orden  |

---

### 5. Pagos

Usé **Stripe Checkout** para el procesamiento de pagos. La razón fue simple: delegar toda la complejidad de seguridad del pago (PCI DSS, 3D Secure, manejo de tarjetas) a Stripe y solo manejar el resultado en mi backend mediante un webhook.

**Flujo de pago:**
1. `POST /payments/checkout` recibe el `orderId`, construye los line items con `unitPriceInCents` y `productNameSnapshot`, y crea la sesión en Stripe
2. Stripe retorna una URL de pago que el frontend redirige al usuario
3. Al completar el pago, Stripe llama a `POST /payments/webhook`
4. El webhook verifica la firma, actualiza la orden a `PAID`, confirma el stock y encola los jobs de factura, email y notificación de envío

**Seguridad del webhook:**
El handler usa `RawBodyRequest` para recibir el cuerpo sin parsear, necesario para verificar la firma HMAC-SHA256 con `stripe.webhooks.constructEvent()`. Sin esto, cualquier llamada externa podría simular un pago exitoso.

**Idempotencia:**
El handler verifica el estado actual de la orden antes de procesarla. Si ya está en `PAID`, no vuelve a ejecutar la lógica. Esto evita procesamiento doble si Stripe reenvía el evento.

El manejo de pagos se realiza bajo los siguientes endpoints:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/payments/checkout` | CLIENT | Crear sesión de pago en Stripe |
| POST | `/payments/webhook`  | Stripe | Recibir confirmación de pago   |


---

## Correr proyecto

### 1. Instalar dependencias
```bash
npm install

```

### 2. Configurar variables de entorno
```bash
cp .env.example .env

```

### 3. Levantar infraestructura (DB + Redis)
```bash
docker-compose up --build
docker-compose up postgres redis -d

```

### 4. Ejecutar en desarrollo
```bash
npm run start:dev

```

### 5. Abrir Swagger
```
Documentacion 
http://localhost:3000/docs

```

### 6. Dashboard de colas BullMQ
```bash
docker-compose up bull-board -d
# Abrir: http://localhost:3030
```

### 7. Probar Stripe
```bash
stripe login
stripe trigger checkout.session.completed

stripe listen --forward-to localhost:3000/payments/webhook

```
