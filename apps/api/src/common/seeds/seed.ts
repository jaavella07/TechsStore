/**
 * SEED SCRIPT — TechsStore
 * Crea datos iniciales: admin, categorías y productos de muestra.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register apps/api/src/common/seeds/seed.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt    from 'bcryptjs';

import { User }             from '../../domains/users/entities/user.entity';
import { RefreshToken }     from '../../domains/users/entities/refresh-token.entity';
import { Category }         from '../../domains/products/entities/category.entity';
import { Product }          from '../../domains/products/entities/product.entity';
import { ProductAttribute } from '../../domains/products/entities/product-attribute.entity';
import { ProductImage }     from '../../domains/products/entities/product-image.entity';
import { Inventory }        from '../../domains/products/entities/inventory.entity';
import { Cart }             from '../../domains/cart/entities/cart.entity';
import { CartItem }         from '../../domains/cart/entities/cart.entity';
import { Order }            from '../../domains/orders/entities/order.entity';
import { OrderItem }        from '../../domains/orders/entities/order.entity';
import { UserRole } from '@shared/enums';


const AppDataSource = new DataSource({
  type:        'postgres',
  host:        process.env.DB_HOST     ?? 'localhost',
  port:        parseInt(process.env.DB_PORT ?? '5432'),
  username:    process.env.DB_USER     ?? 'postgres',
  password:    process.env.DB_PASS     ?? 'postgres',
  database:    process.env.DB_NAME     ?? 'techsstore',
  synchronize: true,
  entities:    [
    User, RefreshToken, Category, Product, ProductAttribute,
    ProductImage, Inventory, Cart, CartItem, Order, OrderItem,
  ],
});

async function seed() {
  await AppDataSource.initialize();
  console.log('📦  Conectado a la base de datos...\n');

  // ── 1. USUARIOS ───────────────────────────────────────────
  const usersRepo = AppDataSource.getRepository(User);

  const adminExists = await usersRepo.findOne({ where: { email: 'admin@techsstore.com' } });
  if (!adminExists) {
    const admin = usersRepo.create({
      name:     'Admin TechsStore',
      email:    'admin@techsstore.com',
      password: await bcrypt.hash('Admin1234', 12),
      role:     UserRole.ADMIN,
      isActive: true,
    });
    await usersRepo.save(admin);
    console.log('✅  Admin creado: admin@techsstore.com / Admin1234');
  }

  const clientExists = await usersRepo.findOne({ where: { email: 'cliente@techsstore.com' } });
  if (!clientExists) {
    const client = usersRepo.create({
      name:     'Cliente Demo',
      email:    'cliente@techsstore.com',
      password: await bcrypt.hash('Client123', 12),
      role:     UserRole.CLIENT,
      isActive: true,
    });
    await usersRepo.save(client);
    console.log('✅  Cliente creado: cliente@techsstore.com / Client123');
  }

  // ── 2. CATEGORÍAS ─────────────────────────────────────────
  const categoriesRepo = AppDataSource.getRepository(Category);

  const categoryData = [
    { name: 'Smartphones',    slug: 'smartphones',    description: 'Teléfonos de última generación' },
    { name: 'Laptops',        slug: 'laptops',        description: 'Computadoras portátiles' },
    { name: 'Auriculares',    slug: 'auriculares',    description: 'Audio de alta calidad' },
    { name: 'Accesorios',     slug: 'accesorios',     description: 'Cables, fundas y más' },
    { name: 'Smartwatches',   slug: 'smartwatches',   description: 'Relojes inteligentes' },
  ];

  const categories: Record<string, Category> = {};
  for (const cat of categoryData) {
    let category = await categoriesRepo.findOne({ where: { slug: cat.slug } });
    if (!category) {
      category = categoriesRepo.create(cat);
      await categoriesRepo.save(category);
      console.log(`✅  Categoría: ${cat.name}`);
    }
    categories[cat.slug] = category;
  }

  // ── 3. PRODUCTOS ──────────────────────────────────────────
  const productsRepo   = AppDataSource.getRepository(Product);
  const inventoryRepo  = AppDataSource.getRepository(Inventory);

  const productsData = [
    {
      name:           'iPhone 15 Pro Max',
      slug:           'iphone-15-pro-max',
      description:    'El iPhone más avanzado con chip A17 Pro, pantalla Super Retina XDR de 6.7", cámara de 48 MP y titanio de grado aeroespacial.',
      priceInCents:   149999,  // $1,499.99
      discountPercent: 0,
      sku:            'APPL-IP15PM-BLK-256',
      brand:          'Apple',
      category:       categories['smartphones'],
      stock:          50,
      attributes: [
        { key: 'Almacenamiento', value: '256 GB' },
        { key: 'Color',          value: 'Titanio Negro' },
        { key: 'Pantalla',       value: '6.7 pulgadas Super Retina XDR' },
        { key: 'Chip',           value: 'A17 Pro' },
        { key: 'Batería',        value: '4422 mAh' },
      ],
      images: [
        { url: 'https://placehold.co/800x800?text=iPhone+15+Pro+Max', isPrimary: true, sortOrder: 0 },
        { url: 'https://placehold.co/800x800?text=iPhone+15+Pro+Max+2', isPrimary: false, sortOrder: 1 },
      ],
    },
    {
      name:           'MacBook Pro 14" M3 Pro',
      slug:           'macbook-pro-14-m3-pro',
      description:    'El MacBook Pro más potente con chip M3 Pro, pantalla Liquid Retina XDR de 14.2", hasta 18 horas de batería y 18 GB de memoria unificada.',
      priceInCents:   199999,  // $1,999.99
      discountPercent: 5,
      sku:            'APPL-MBP14-M3PRO-18-512',
      brand:          'Apple',
      category:       categories['laptops'],
      stock:          30,
      attributes: [
        { key: 'Chip',    value: 'Apple M3 Pro' },
        { key: 'RAM',     value: '18 GB' },
        { key: 'Storage', value: '512 GB SSD' },
        { key: 'Pantalla',value: '14.2" Liquid Retina XDR' },
        { key: 'Batería', value: 'Hasta 18 horas' },
      ],
      images: [
        { url: 'https://placehold.co/800x800?text=MacBook+Pro+14', isPrimary: true, sortOrder: 0 },
      ],
    },
    {
      name:           'Sony WH-1000XM5',
      slug:           'sony-wh-1000xm5',
      description:    'Auriculares inalámbricos con cancelación de ruido líder del sector, 30 horas de batería y audio de alta resolución.',
      priceInCents:   34999,   // $349.99
      discountPercent: 10,
      sku:            'SONY-WH1000XM5-BLK',
      brand:          'Sony',
      category:       categories['auriculares'],
      stock:          80,
      attributes: [
        { key: 'Conectividad', value: 'Bluetooth 5.2' },
        { key: 'Batería',      value: '30 horas' },
        { key: 'ANC',          value: 'Cancelación de ruido dual' },
        { key: 'Color',        value: 'Negro' },
      ],
      images: [
        { url: 'https://placehold.co/800x800?text=Sony+WH-1000XM5', isPrimary: true, sortOrder: 0 },
      ],
    },
    {
      name:           'Samsung Galaxy S24 Ultra',
      slug:           'samsung-galaxy-s24-ultra',
      description:    'El Galaxy más potente con S Pen integrado, cámara de 200 MP, procesador Snapdragon 8 Gen 3 y pantalla Dynamic AMOLED 2X de 6.8".',
      priceInCents:   129999,  // $1,299.99
      discountPercent: 0,
      sku:            'SAMS-GS24U-TIT-256',
      brand:          'Samsung',
      category:       categories['smartphones'],
      stock:          45,
      attributes: [
        { key: 'Almacenamiento', value: '256 GB' },
        { key: 'RAM',            value: '12 GB' },
        { key: 'Cámara',         value: '200 MP + 12 MP + 50 MP + 10 MP' },
        { key: 'Pantalla',       value: '6.8" Dynamic AMOLED 2X' },
        { key: 'Batería',        value: '5000 mAh' },
      ],
      images: [
        { url: 'https://placehold.co/800x800?text=Galaxy+S24+Ultra', isPrimary: true, sortOrder: 0 },
      ],
    },
    {
      name:           'Apple Watch Series 9',
      slug:           'apple-watch-series-9',
      description:    'Apple Watch con chip S9, pantalla Retina siempre activa más brillante, detección de caídas y ECG de primera generación.',
      priceInCents:   39999,   // $399.99
      discountPercent: 0,
      sku:            'APPL-AWS9-41-MID',
      brand:          'Apple',
      category:       categories['smartwatches'],
      stock:          60,
      attributes: [
        { key: 'Tamaño',  value: '41 mm' },
        { key: 'Chip',    value: 'S9' },
        { key: 'GPS',     value: 'Sí' },
        { key: 'Batería', value: '18 horas' },
        { key: 'Color',   value: 'Medianoche' },
      ],
      images: [
        { url: 'https://placehold.co/800x800?text=Apple+Watch+S9', isPrimary: true, sortOrder: 0 },
      ],
    },
  ];

  const attributesRepo = AppDataSource.getRepository(ProductAttribute);
  const imagesRepo     = AppDataSource.getRepository(ProductImage);

  for (const data of productsData) {
    const exists = await productsRepo.findOne({ where: { slug: data.slug } });
    if (exists) continue;

    const { stock, attributes, images, category, ...productData } = data;

    const product = productsRepo.create({ ...productData, category });
    const saved   = await productsRepo.save(product);

    // Atributos
    for (const attr of attributes) {
      const a = attributesRepo.create({ ...attr, product: saved });
      await attributesRepo.save(a);
    }

    // Imágenes
    for (const img of images) {
      const i = imagesRepo.create({ ...img, product: saved });
      await imagesRepo.save(i);
    }

    // Inventario
    const inv = inventoryRepo.create({ product: saved, totalStock: stock, reservedStock: 0, lowStockThreshold: 5 });
    await inventoryRepo.save(inv);

    console.log(`✅  Producto: ${data.name} (stock: ${stock})`);
  }

  await AppDataSource.destroy();
  console.log('\n🎉  Seed completado exitosamente!\n');
  console.log('   Admin:   admin@techsstore.com  / Admin1234');
  console.log('   Cliente: cliente@techsstore.com / Client123\n');
}

seed().catch((err) => {
  console.error('❌  Error en el seed:', err);
  process.exit(1);
});
