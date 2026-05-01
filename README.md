# 🛒 TechsStore — E-Commerce

¿Porque crear este proyecto?

Mi objetivo es desarrollar TechsStore para reforzar lo aprendido en mi camino como Junior, reforzando conceptos y enfrendandome a problemas reales que este desarrollo puede generar, tabien lograr implementar un asistente que se personalice según lo que el usuario necesite. 
Este e-commerce es para aquellas micro-tiendas que hoy en dia solo operan de manera física y la primera prueba de fuego será aplicarlo al negocio de mi familia "El Mirador".

Con base en lo anterior cuento con los siguientes repositorios,

1. agent_LangGraph: https://github.com/jaavella07/agent_LangGraph
2. microservices:   https://github.com/jaavella07/microservices
3. bookstore-api:   https://github.com/jaavella07/bookstore-api

Y por lo tanto mantendre documentado mi proceso de desarrollo.

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

Access Token: **60 min** (corta vida, sin estado)
Refresh Token: **7 días** (valor almacenado en BD y hasheado con bcrypt)
Al usar un refresh token, se revoca y se emite uno nuevo

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


### 2. Productos 

Si bien sabemos los producto son la razon de ser en el desarrollo de un e-commerce y su manejo debe ser ordenado y estructurado, por lo tanto esta seccion de la BD cuenta con las siguientes tablas.

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

El carrito necesita token de acceso ya se cliente o admin. Cada operación ajusta las reservas de inventario automáticamente. 

El manejo de reserva de productos se realiza bajo los siguientes endpoint:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET  | `/cart`               | CLIENT | Ver carrito activo  |
| POST | `/cart/items`         | CLIENT | Añadir al carrito   |
|PATCH | `/cart/items/:itemId` | CLIENT | Ajustar reserva     |
|DELETE| `/cart/items/:itemId` | CLIENT | Liberar reserva     |


---
### 4. Ordernes 


El manejo de ordenes se realiza bajo los siguientes endpoint:

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET  | `/orders/me`         | Público | Mis órdenes                 |
| POST | `/orders`            | Público | Crear orden desde carrito   |
|PATCH | `/orders/:id/status` | ADMIN   | Actualizar estado de orden  |


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
