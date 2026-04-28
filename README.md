# 🛒 TechsStore — E-Commerce en NestJS 

> Stack: **NestJS · TypeORM · PostgreSQL · Redis · BullMQ · Stripe · Langchain · LangGraph

---
¿Porque?

Con base en los siguientes repositorios,

1. agent_LangGraph: https://github.com/jaavella07/agent_LangGraph
2. microservices: https://github.com/jaavella07/microservices
3. bookstore-api: https://github.com/jaavella07/bookstore-api


Y aplicando lo aprendido, decidi implementar TechsStore donde busco abarcar y profundizar conceptos. Con base en lo anterior, mantendre documentado mi proceso de desarrollo.

Creacion repositorio: 27/04/26

---

---

## Decisiones de diseño

### 1. Manejo de usuario 

Tomando el repositorio **bookstore-api** como referencia se realice la construccion del manejo de autenticacion y autorizacion de usuarios de la siguientes manera:

JWT con Rotación de Refresh Tokens
- Access Token: **60 min** (corta vida, sin estado)
- Refresh Token: **7 días** (valor almacenado en BD y hasheado con bcrypt)
- Al usar un refresh token se **revoca** y se emite uno nuevo
- Proteccion de rutas bajo los siguientes roles:
  -ADMIN
  -CLIENT

---

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
