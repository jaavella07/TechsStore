# 🛒 TechsStore — E-Commerce

---
¿Porque crear este proyecto?

Mi objetivo es desarrollar TechsStore para reforzar lo aprendido en mi camino como Junior, reforzando conceptos y enfrendandome a problemas reales que este desarrollo puede generar. El e-commerce dinámico es para aquellas micro-tiendas que hoy en dia solo operan de manera física y lograr sumarle un asistente que se personalice según lo que el usuario necesite. La primera prueba de fuego será aplicarlo al negocio de mi familia "El Mirador".

Con base en lo anterior cuento con los siguientes repositorios,

1. agent_LangGraph: https://github.com/jaavella07/agent_LangGraph
2. microservices:   https://github.com/jaavella07/microservices
3. bookstore-api:   https://github.com/jaavella07/bookstore-api

Por lo tanto mantendre documentado mi proceso de desarrollo.

---

## Decisiones de diseño

---
> Stack: NestJS · TypeORM · PostgreSQL · Redis · BullMQ · Stripe · Langchain · LangGraph
---
> Base de Datos: La BD usada fue Postgre gestionada a través del ORM TypeORM, la cual me ayuda a generar el almacenamiento de usuario,inventario de productos, categorias, ordenes, además del manejo temporal del carrito de compras. También uso Postgre como base de datos para persistir el estado y la memoria del asistente virtual.
---

### 1. Manejo de usuarios 

Tomando el repositorio **bookstore-api** como referencia, realice la construccion del manejo de autenticacion y autorizacion de usuarios de la siguientes manera:

**Autenticacion (auth-users)**

Estos modulos cuentan con la configuracion de registro, acceso, validacion, renovacion, cambio de estado, autorizacion y Logout.

JWT con Rotación de Refresh Tokens
- Access Token: **60 min** (corta vida, sin estado)
- Refresh Token: **7 días** (valor almacenado en BD y hasheado con bcrypt)
- Al usar un refresh token se **revoca** y se emite uno nuevo

STRATEGIES para el manejo del JWT 

GUARD proteccion de rutas bajo los siguientes roles:
  -ADMIN
  -CLIENT

El manejo de usuarios se realiza bajo los siguientes endpoint:

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
| POST | `/products`                      | ADMIN   | Crear producto                 |
|PATCH | `/products/:id/inventory/adjust` | ADMIN   | Ajuste manual de stock         |


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
