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
  - AGENT (solo lectura de órdenes proyectadas sin PII)

El manejo de usuarios se realiza bajo los siguientes endpoints:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST   | `/auth/register`   | Público     | Registrar usuario y obtener tokens    |
| POST   | `/auth/login`      | Público     | Iniciar sesión                        |
| POST   | `/auth/refresh`    | Público     | Renovar access token                  |
| POST   | `/auth/logout`     | Autenticado | Revocar todos los refresh tokens      |
| GET    | `/auth/me`         | Autenticado | Verificar token y obtener usuario     |
| POST   | `/users/register`  | Público     | Registrar cliente sin tokens          |
| GET    | `/users`           | ADMIN       | Listar usuarios paginados             |
| GET    | `/users/me`        | Autenticado | Ver mi perfil                         |
| GET    | `/users/:id`       | ADMIN       | Ver usuario por ID                    |
| PATCH  | `/users/me`        | Autenticado | Actualizar mi perfil                  |
| PATCH  | `/users/:id/role`  | ADMIN       | Cambiar rol por ID                    |
| DELETE | `/users/:id`       | ADMIN       | Desactivar usuario (soft delete)      |

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
| GET    | `/products`                      | Público | Listar con filtros y paginación (`search`, `categoryId`, `brand`, `minPrice`, `maxPrice`, `sortBy`, `offset`, `limit`) |
| GET    | `/products/categories`           | Público | Listar categorías activas con sus hijos |
| GET    | `/products/:id`                  | Público | Ver detalle de producto por ID          |
| GET    | `/products/slug/:slug`           | Público | Ver detalle de producto por slug        |
| POST   | `/products`                      | ADMIN   | Crear producto con stock inicial        |
| PATCH  | `/products/:id`                  | ADMIN   | Actualizar producto                     |
| DELETE | `/products/:id`                  | ADMIN   | Desactivar producto (soft delete)       |
| GET    | `/products/:id/inventory`        | ADMIN   | Ver inventario de un producto           |
| PATCH  | `/products/:id/inventory/adjust` | ADMIN   | Ajuste manual de stock (+/-)            |
| POST   | `/products/categories`           | ADMIN   | Crear categoría                         |
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
| POST   | `/orders`                    | CLIENT       | Crear orden desde el carrito activo                                    |
| GET    | `/orders/me`                 | CLIENT       | Mis órdenes — acepta `?status=PAID\|PENDING\|…`, `?page`, `?limit`    |
| GET    | `/orders`                    | ADMIN, AGENT | Listar todas — `?orderNumber`, `?email`, `?trackingNumber`, `?status` |
| GET    | `/orders/:id`                | Autenticado  | Detalle de orden (CLIENT solo ve las propias; ADMIN ve cualquiera)     |
| PATCH  | `/orders/:id/status`         | ADMIN        | Cambiar estado y asignar número de rastreo                             |

Ejemplo peticion POST orders
{
  "shippingAddress": {
    "street": "Av. Principal 123",
    "city": "Bogotá",
    "state": "Cundinamarca",
    "country": "CO",
    "zipCode": "110111"
  }
}

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

### 6. Colas (BullMQ)

Cuando Stripe confirma un pago hay varias cosas que tienen que pasar al mismo tiempo: actualizar la orden, generar la factura, enviar el correo y avisar que hay un envío pendiente. Al principio pensé en hacer todo eso en el mismo lugar donde llega la confirmación de Stripe, pero me di cuenta de que si algo fallaba (el correo, por ejemplo) todo se caía. Ahí fue cuando aprendí para qué sirven las colas.

Con **BullMQ** cada tarea queda en una lista de pendientes guardada en Redis. Si algo falla, lo reintenta solo. No tengo que preocuparme por eso.

| Cola | Qué hace |
|------|----------|
| `orders-queue`   | Actualiza la orden y descuenta el stock |
| `invoices-queue` | Genera el PDF de la factura |
| `emails-queue`   | Envía el correo de confirmación |
| `shipping-queue` | Avisa que hay un pedido listo para enviar |

Para no escribir el nombre de cada cola como texto suelto en varios archivos, los centralicé en `shared/enums`. Si algún día cambio un nombre, lo cambio en un solo lugar.

En Docker hay un panel visual en `localhost:3030` (Bull Board) donde puedo ver cuántos jobs están pendientes, cuáles fallaron y cuáles ya terminaron. Me resultó muy útil para depurar.

---

### 7. Notificaciones

Este fue el módulo que más me costó construir al principio. La idea es que cuando pasa algo importante en la tienda (un pago, un envío) el cliente recibe un correo. Lo complicado fue separarlo del resto de la app. De manera que en un futuro sea mas facil adaptar otro tipo de notificaciones, como puede ser WhatsApp.

El microservicio de notificaciones corre por su cuenta, en otro proceso. La API le manda una señal por **TCP** diciéndole qué correo enviar, y él se encarga del resto usando **Nodemailer**.

Los correos que puede enviar son:
- Confirmación de orden
- Aviso de envío con número de rastreo
- Factura lista para descargar(PDF)
- Bienvenida al registrarse

Todos usan la misma plantilla HTML que armé en `MailService`, así todos los correos se ven igual y con el logo de TechsStore.

Algo que me generó un error al levantar Docker fue que intenté usar el mismo puerto (`4000`) para dos cosas distintas dentro del mismo proceso: recibir mensajes TCP de la API y levantar el servidor HTTP. Eso causó un `EADDRINUSE`. Lo resolví usando puertos separados: TCP en `4000` y HTTP en `4001`. Truco del profesor Fernando Herrera aprendido en el repositorio de microservices.

---

### Despliegue Docker — Errores y resoluciones

Al intentar levantar el proyecto por primera vez con `docker-compose up`, me encontré con una cadena de cuatro errores que, vistos uno a uno, parecían aislados pero en realidad tenían causas raíz distintas. Documentar esto aquí me sirve de referencia y explica por qué el `docker-compose.yml` y los Dockerfiles tienen ciertas decisiones que de otro modo lucen innecesarias.

**Error 1 — `Cannot find module '/app/dist/apps/api/main'`**

El contenedor arrancaba y moría inmediatamente. La compilación había "funcionado", pero el `dist/` llegaba vacío al stage de producción. La causa: no existía `.dockerignore`. Creé `.dockerignore` excluyendo `node_modules`, `dist`, `.git` y `.env`, y el problema desapareció.

**Error 2 — `ECONNREFUSED 172.x.x.x:5433`**

La API no conectaba a Postgres. El `.env` local usa `DB_PORT=5433` para conectarse desde el host, pero dentro de la red Docker el servicio `postgres` expone el puerto `5432`. El `docker-compose.yml` sobreescribía `DB_HOST` con el nombre del servicio pero no el puerto. Agregué `DB_PORT: 5432` a la sección `environment` del servicio `api`.

**Error 4 — `EADDRINUSE :::4000`**

El microservicio de notificaciones crasheaba al intentar escuchar dos veces en el mismo puerto. `main.ts` usaba `NOTIFICATIONS_PORT` tanto para el transporte TCP como para el servidor HTTP. Separé los puertos en dos variables: `NOTIFICATIONS_TCP_PORT=4000` (el que el API usa para enviar mensajes) y `NOTIFICATIONS_HTTP_PORT=4001` (servidor interno del microservicio).

---

### Notas 

Con ayuda del modelo de Gemini pro 3.1 y usando el siguiente prompt, se realizo la insercion de productos en la Base de datos, para la ejecucion de pruebas. 

```
Con base en las entidades definidas para productos, genera un script SQL completo para la creación e inserción de datos de productos.


| Tabla | Descripción | 
|---|---|---|
| `categories` | Árbol de categorías por sector (raíz + subcategorías) | 
| `categories_closure` | Relaciones padre→hijo |
| `products` | Productos con precio en centavos, SKU, marca y descuento |
| `product_attributes` | Atributos clave-valor por producto (RAM, color, peso, etc.) | 
| `product_images` | Imágenes con orden y flag `is_primary` | 
| `inventory` | Stock total, reservado y umbral de alerta por producto | 


Los datos deben ser flexible y adaptable a diferentes tipos de negocios, incluyendo:

Tiendas de tecnología (celulares, laptops, accesorios, periféricos, etc.)
Microempresas (productos artesanales, ropa, cosméticos, emprendimientos locales, etc.)
Tiendas de barrio o minimercados (leche, huevos, paquetes, bebidas, dulces, productos de canasta familiar, aseo, entre otros)

El resultado debe entregarse en SQL estándar, organizado y listo para ejecutarse en PostgreSQL.

```

Con los datos de prueba ya en el SQL, necesitaba una forma de cargarlos sin salir del entorno HTTP ni ejecutar scripts manuales. Decidí exponer un endpoint `POST /seed/run` protegido por JWT y rol `ADMIN` que lee y ejecuta `seed-multisector.sql` en tiempo de ejecución.

El punto técnico más relevante fue no usar repositorios individuales de TypeORM sino inyectar el `DataSource` directamente con `@InjectDataSource()`. Eso me permitió abrir un `QueryRunner`, iniciar una transacción propia y ejecutar cada sentencia SQL en secuencia, haciendo rollback automático si alguna falla. 

Los archivos generados: `seed.service.ts`, `seed.controller.ts` y `seed.module.ts` en `apps/api/src/common/seeds/`, con `SeedModule` registrado en `AppModule`.

---

### Integración con el agente conversacional (`agent-ecommerce`)

El proyecto cuenta con un asistente conversacional construido en LangGraph/TypeScript que corre como proceso separado. Para que el agente pudiera consultar órdenes reales de TechsStore, necesitaba filtrar por **número de orden**, **email del comprador** y **número de rastreo**, pero el endpoint `GET /api/v1/orders` solo aceptaba `page` y `limit`.

El problema era que el agente nunca maneja UUIDs internos: cuando un cliente dice "¿dónde está mi pedido ORD-20240515-A3K9?" el agente necesita buscar por ese número legible, no por un UUID que el usuario jamás ve. Lo mismo pasa con el rastreo: el `trackingNumber` ya vive dentro de la entidad `Order`, no en un endpoint `/tracking` separado.

La solución fue añadir **tres query params opcionales** al endpoint admin existente, sin crear nuevas rutas. Usé `QueryBuilder` en lugar del `findAndCount` original para poder encadenar filtros condicionales solo cuando el param llega. Sin `QueryBuilder` tendría que haber creado variantes del método o usado condiciones con `undefined` en el `where`, lo cual se vuelve ilegible rápido.

Los archivos modificados fueron:

| Archivo | Cambio |
|---|---|
| `orders/dto/order.dto.ts` | Nueva clase `AdminOrdersFilterDto` con `orderNumber?`, `email?`, `trackingNumber?` |
| `orders/services/orders.service.ts` | `findAll()` migrado a QueryBuilder con filtros condicionales |
| `orders/controllers/orders.controller.ts` | `GET /orders` ahora recibe `AdminOrdersFilterDto` |

Los nuevos params son todos opcionales, así que el endpoint existente sigue funcionando exactamente igual cuando se llama sin filtros.

La integración del API con el agente conversacional requirió ajustes adicionales de calidad en el backend, documentados en la siguiente sección.

**Errores encontrados en pruebas de integración:**

**Error 1 — `productId must be a UUID` al agregar ítem al carrito**

Al ejecutar `POST /api/v1/cart/items` con un `productId` del seed, el validador rechazaba el request. La causa: `@IsUUID()` (Stream B — B5) exige que el UUID cumpla la especificación RFC 4122, con dígito de versión `[1-8]` y variante `[89ab]`. Los IDs hardcodeados del seed (`b1000000-0000-0000-0000-000000000001`) tenían versión `0` y variante `0`, que Postgres acepta pero `class-validator` rechaza.

La solución fue **corregir los UUID en `seed-multisector.sql`**: reemplazo global de `-0000-0000-0000-` → `-0000-4000-8000-` (versión 4 + variante RFC 4122), aplicado en las 237 ocurrencias del archivo (categorías, closure, productos, atributos, imágenes e inventario). La integridad referencial se preserva sola porque PKs y FKs usaban el mismo patrón. La validación `@IsUUID()` en el DTO se mantiene como protección real de entrada.

**Error 2 — `column inv.productid does not exist` en reserva de stock**

Una vez resuelto el primer error, el `POST /api/v1/cart/items` devolvía un 500. En el log aparecía:
```
WHERE inv.productId = $1
error: column inv.productid does not exist
```
El `InventoryService` usaba `.where('inv.productId = :productId')` en cuatro métodos (`reserve`, `release`, `confirmSale`, `adjust`). PostgreSQL trata los identificadores sin comillas como lowercase, convirtiendo `productId` en `productid`, que no existe — la columna real es `product_id`. La corrección fue cambiar a `.where('inv.product_id = :productId')` en los cuatro lugares.

**Error 3 — `stripe` no reconocido como comando en PowerShell**

Al intentar correr `stripe listen --forward-to localhost:3000/payments/webhook`, PowerShell devolvía:
```
stripe : El término 'stripe' no se reconoce como nombre de un cmdlet, función, archivo de script o programa ejecutable.
```
La causa fue que la Stripe CLI no estaba instalada en el sistema. La solución fue instalarla vía Scoop:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
stripe login   # vincula la cuenta de Stripe una sola vez
```

**Error 4 — Orden queda en `PENDING` tras pago exitoso en Stripe**

Stripe mostraba `payment_status: "paid"` y `status: "complete"`, pero la orden en la BD seguía en `PENDING` y `stripePaymentIntentId` era `null`. La causa fue que `stripe listen` no estaba corriendo al momento del pago, por lo que el evento `checkout.session.completed` nunca llegó al webhook local. La solución fue levantar el listener **antes** de iniciar el flujo de pago y reenviar el evento perdido:
```bash
stripe listen --forward-to localhost:3000/payments/webhook
stripe events list --limit 5   # obtener el ID del evento
stripe events resend evt_XXXXXXXX
```
El orden correcto de arranque es: `npm run start:dev` → `stripe listen` → generar checkout → pagar.

**Error 5 — `ERR_CONNECTION_REFUSED` en `localhost:4200` tras completar el pago**

Al finalizar el pago en Stripe, el navegador redirigía a `http://localhost:4200/checkout/success?session_id=...` y mostraba error de conexión rechazada. La causa es que no hay frontend corriendo en el puerto 4200 — Stripe redirige al `success_url` configurado al crear la sesión de checkout. Este error es cosmético: no afecta el webhook ni el procesamiento de la orden. En producción el frontend estará levantado y la redirección funcionará correctamente.

---

### 8. Calidad de endpoints

Tras integrar el agente conversacional se identificaron y corrigieron problemas de calidad en los endpoints del backend.

**B1 — Eliminar eager loading y N+1**

Se removió `eager: true` de `Order.items`, `OrderItem.product`, `Product.attributes` y `Product.images`. Las relaciones ahora se cargan solo donde se usan. Adicionalmente, `products.findAll` y `orders.findAll` usan paginación en dos pasos (count → IDs paginados → hydrate) para evitar el bug de `SELECT DISTINCT / ORDER BY` que Postgres rechaza cuando se combina JOIN + skip/take en la misma query.

**B2 — Proyección de usuario en órdenes**

Las respuestas de órdenes ya no incluían el objeto `User` completo (con password hasheado y tokens). `orders.findOne` y `orders.findAll` proyectan solo `{id, name, email}` via `addSelect`. `auth.register` y `auth.login` retornan el usuario saneado con `sanitizeUser()`.

**B3 — Filtro por estado en /orders/me**

`GET /orders/me` acepta ahora `?status=PAID|PENDING|PROCESSING|…` como query param opcional. `MyOrdersFilterDto` extiende `PaginationDto` y añade el campo `status`.

**B4 — Rate limiting**

`ThrottlerModule` configurado globalmente (60 req/min). Los endpoints de registro e inicio de sesión tienen un límite más estricto de 5 req/min con `@Throttle({ default: { ttl: 60_000, limit: 5 } })`.

**B5 — Validación UUID en carrito**

`AddToCartDto.productId` valida con `@IsUUID()` en lugar de `@IsString()`. Ver Error 1 arriba para el fix asociado en el seed.

**PaginationDto unificado**

Existían dos clases `PaginationDto` en distintos lugares del proyecto. Se consolidaron en `apps/api/src/common/dto/pagination.dto.ts`:
- `PaginationDto` — `{page, limit}` — usada por orders y users
- `OffsetPaginationDto` — `{offset, limit}` — usada por products (`ProductFilterDto`)

---

### 9. Rutas del agente conversacional

El agente conversacional no es un usuario humano: es un proceso LangGraph que hace llamadas HTTP a la API para responder preguntas del cliente. Eso implicó una decisión de diseño que no tuve que tomar en ningún módulo anterior — **¿qué puede ver el agente y qué no?**

La respuesta la tiene el rol `AGENT`. El agente necesita saber si un pedido existe, cuál es su estado y si tiene número de rastreo. No necesita ver el email del comprador, su nombre completo ni ningún dato personal. Exponerlos sería innecesario y un riesgo de privacidad. Por eso `GET /orders` devuelve dos shapes distintos según quién llame:

- Si llama **ADMIN**: recibe la orden completa con `user: {id, name, email}`.
- Si llama **AGENT**: recibe `AgentOrderView`, una proyección que omite cualquier dato de usuario y solo trae lo operativo: `orderNumber`, `status`, `trackingNumber`, `createdAt` y los ítems con `productNameSnapshot`, `quantity` y `unitPriceInCents`.

El agente se crea automáticamente al correr el seed con las credenciales `agent@techsstore.com / AgentPass123` (configurables vía `SEED_AGENT_EMAIL` / `SEED_AGENT_PASSWORD`). Su flujo de autenticación es idéntico al de cualquier usuario: hace `POST /auth/login` en el primer request, cachea el `accessToken` y usa `POST /auth/refresh` cuando recibe un 401.

**Rutas accesibles por el rol AGENT:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | `/auth/login`   | Obtener tokens (primera vez o tras expiración)                        |
| POST   | `/auth/refresh` | Renovar access token con el refresh token                             |
| POST   | `/auth/logout`  | Revocar sesión                                                        |
| GET    | `/auth/me`      | Verificar que el token sigue válido                                   |
| GET    | `/orders`       | Consultar órdenes — respuesta proyectada sin PII (ver tabla abajo)    |
| GET    | `/products`     | Buscar productos por `search`, `categoryId`, `brand`, `minPrice`, etc.|
| GET    | `/products/categories` | Listar categorías (para recomendaciones por sector)            |
| GET    | `/products/:id` | Ver detalle de un producto por ID                                     |
| GET    | `/products/slug/:slug` | Ver detalle de un producto por slug                            |

**Rutas bloqueadas para AGENT (acceso denegado):**

| Ruta | Motivo |
|------|--------|
| `GET /orders/:id`       | Solo ADMIN o el CLIENT dueño de la orden pueden ver el detalle |
| `GET /orders/me`        | Devuelve las órdenes propias — el agente no compra             |
| `POST /orders`          | El agente no crea órdenes                                      |
| `PATCH /orders/:id/status` | Solo ADMIN puede cambiar estados                            |
| `GET /users`, `GET /users/:id` | Solo ADMIN tiene acceso a datos de usuario            |

**Filtros disponibles en `GET /orders` para el agente:**

| Query param | Ejemplo | Cuándo lo usa el agente |
|-------------|---------|------------------------|
| `orderNumber`    | `ORD-20240515-A3K9` | Cliente pregunta por un número de orden legible |
| `email`          | `cliente@ejemplo.com` | Cliente da su correo para ver sus pedidos |
| `trackingNumber` | `MX-DHL-12345` | Cliente pregunta por el estado de un envío |
| `status`         | `PAID`, `SHIPPED` | Filtrar por estado específico |
| `page`, `limit`  | `1`, `10` | Paginación estándar |

**Shape de respuesta `AgentOrderView` (lo que recibe el agente):**

```json
{
  "orderNumber": "ORD-20240515-A3K9",
  "status": "SHIPPED",
  "trackingNumber": "MX-DHL-12345",
  "createdAt": "2024-05-15T10:30:00.000Z",
  "items": [
    {
      "productNameSnapshot": "Samsung Galaxy A54 5G",
      "quantity": 1,
      "unitPriceInCents": 34999
    }
  ]
}
```

Nótese que no hay `user`, no hay `totalInCents` en el nivel de la orden ni ningún identificador interno. El agente opera únicamente con datos que el cliente mismo conoce.

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

### 3. Opción A — Todo en Docker (simula producción)
```bash
docker-compose up --build -d
```
Levanta: PostgreSQL · Redis · API · Notifications · Bull Board

### 4. Opción B — Solo infraestructura en Docker + apps en local 
```bash

docker-compose up postgres redis bull-board -d


npm run start:dev                    # API en localhost:3000
npm run start:dev:notifications      # Notifications en localhost:4000
docker-compose up --build -d api     # Cambios solo en la imagen api
```

### 5. Verificar que todo esté corriendo
```bash
docker-compose ps
```

### 6. URLs disponibles

| Servicio | URL |
|---|---|
| API | `http://localhost:3000/api/v1` |
| Swagger (docs) | `http://localhost:3000/docs` |
| Bull Board (colas) | `http://localhost:3030` |

### 7. Probar Stripe
```bash
stripe login
stripe listen --forward-to localhost:3000/payments/webhook
stripe trigger checkout.session.completed
```