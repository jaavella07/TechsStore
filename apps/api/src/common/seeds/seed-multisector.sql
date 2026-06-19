-- ================================================================
-- TECHSSTORE — Seed SQL Multisector
-- Sectores: Tecnología · Microempresa · Tienda de Barrio
-- Base de datos: PostgreSQL 14+  |  Compatible con TypeORM 0.3+
-- Ejecución: psql -U postgres -d techsstore -f seed-multisector.sql
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- SECCIÓN 1: DDL — Creación de tablas
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          UUID         NOT NULL DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL,
  description TEXT,
  image_url   VARCHAR,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  parent_id   UUID,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_categories        PRIMARY KEY (id),
  CONSTRAINT uq_categories_name   UNIQUE (name),
  CONSTRAINT uq_categories_slug   UNIQUE (slug),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
    REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS categories_closure (
  id_ancestor   UUID NOT NULL,
  id_descendant UUID NOT NULL,

  CONSTRAINT pk_categories_closure  PRIMARY KEY (id_ancestor, id_descendant),
  CONSTRAINT fk_closure_ancestor    FOREIGN KEY (id_ancestor)
    REFERENCES categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_closure_descendant  FOREIGN KEY (id_descendant)
    REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id               UUID         NOT NULL DEFAULT gen_random_uuid(),
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(220) NOT NULL,
  description      TEXT         NOT NULL,
  price_in_cents   INTEGER      NOT NULL CHECK (price_in_cents >= 0),
  discount_percent INTEGER      NOT NULL DEFAULT 0
                                CHECK (discount_percent BETWEEN 0 AND 100),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  sku              VARCHAR(100),
  brand            VARCHAR(100),
  category_id      UUID,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_products          PRIMARY KEY (id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug ON products(slug);

CREATE TABLE IF NOT EXISTS product_attributes (
  id         UUID         NOT NULL DEFAULT gen_random_uuid(),
  key        VARCHAR(100) NOT NULL,
  value      VARCHAR(200) NOT NULL,
  product_id UUID         NOT NULL,

  CONSTRAINT pk_product_attributes         PRIMARY KEY (id),
  CONSTRAINT fk_product_attributes_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_images (
  id         UUID         NOT NULL DEFAULT gen_random_uuid(),
  url        VARCHAR      NOT NULL,
  alt_text   VARCHAR(200),
  sort_order INTEGER      NOT NULL DEFAULT 0,
  is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
  product_id UUID         NOT NULL,

  CONSTRAINT pk_product_images         PRIMARY KEY (id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid(),
  total_stock         INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  reserved_stock      INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5  CHECK (low_stock_threshold >= 0),
  product_id          UUID    NOT NULL,

  CONSTRAINT pk_inventory         PRIMARY KEY (id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
);


-- ================================================================
-- SECCIÓN 2: CATEGORÍAS (3 sectores con subcategorías)
-- ================================================================

INSERT INTO categories (id, name, slug, description, is_active, parent_id, created_at, updated_at) VALUES

  -- ── SECTOR 1: TECNOLOGÍA ─────────────────────────────────────
  ('a1000000-0000-4000-8000-000000000001', 'Tecnología',               'tecnologia',             'Electrónica, celulares, laptops y accesorios', TRUE, NULL,                                    NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000002', 'Celulares y Smartphones',  'celulares-smartphones',  'Teléfonos inteligentes Android e iOS',          TRUE, 'a1000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000003', 'Laptops y Computadores',   'laptops-computadores',   'Portátiles para trabajo, diseño y gaming',      TRUE, 'a1000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000004', 'Accesorios y Periféricos', 'accesorios-perifericos', 'Teclados, mouses, hubs y cables',               TRUE, 'a1000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000005', 'Audio y Video',            'audio-video',            'Audífonos, parlantes y monitores',              TRUE, 'a1000000-0000-4000-8000-000000000001', NOW(), NOW()),

  -- ── SECTOR 2: MICROEMPRESA ────────────────────────────────────
  ('a2000000-0000-4000-8000-000000000001', 'Microempresa',             'microempresa',           'Productos de emprendimientos y marcas locales', TRUE, NULL,                                    NOW(), NOW()),
  ('a2000000-0000-4000-8000-000000000002', 'Ropa y Moda Artesanal',   'ropa-moda-artesanal',    'Prendas y accesorios hechos a mano',            TRUE, 'a2000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a2000000-0000-4000-8000-000000000003', 'Cosméticos y Belleza',    'cosmeticos-belleza',     'Cremas, sérums y cuidado natural',              TRUE, 'a2000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a2000000-0000-4000-8000-000000000004', 'Artesanías y Decoración', 'artesanias-decoracion',  'Joyería artesanal, velas y objetos únicos',     TRUE, 'a2000000-0000-4000-8000-000000000001', NOW(), NOW()),

  -- ── SECTOR 3: TIENDA DE BARRIO ────────────────────────────────
  ('a3000000-0000-4000-8000-000000000001', 'Tienda de Barrio',        'tienda-barrio',          'Productos de primera necesidad y canasta',      TRUE, NULL,                                    NOW(), NOW()),
  ('a3000000-0000-4000-8000-000000000002', 'Lácteos y Huevos',       'lacteos-huevos',         'Leche, queso, yogur y huevos frescos',          TRUE, 'a3000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a3000000-0000-4000-8000-000000000003', 'Bebidas',                 'bebidas',                'Gaseosas, jugos, agua y cervezas',              TRUE, 'a3000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a3000000-0000-4000-8000-000000000004', 'Snacks y Dulces',        'snacks-dulces',           'Papas, chocolates, galletas y confites',        TRUE, 'a3000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a3000000-0000-4000-8000-000000000005', 'Aseo y Limpieza',        'aseo-limpieza',           'Jabones, detergentes y desinfectantes',         TRUE, 'a3000000-0000-4000-8000-000000000001', NOW(), NOW()),
  ('a3000000-0000-4000-8000-000000000006', 'Canasta Familiar',        'canasta-familiar',        'Arroz, aceite, azúcar, sal y granos',           TRUE, 'a3000000-0000-4000-8000-000000000001', NOW(), NOW())

ON CONFLICT (id) DO NOTHING;



INSERT INTO categories_closure (id_ancestor, id_descendant) VALUES
  -- Tecnología
  ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003'),
  ('a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004'),
  ('a1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005'),
  ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003'),
  ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004'),
  ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005'),
  -- Microempresa
  ('a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000003'),
  ('a2000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000004'),
  ('a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000003'),
  ('a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000004'),
  -- Tienda de Barrio
  ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000003'),
  ('a3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000004'),
  ('a3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000005'),
  ('a3000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000006'),
  ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003'),
  ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000004'),
  ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000005'),
  ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000006')
ON CONFLICT (id_ancestor, id_descendant) DO NOTHING;


-- ================================================================
-- SECCIÓN 3: PRODUCTOS
-- ================================================================

INSERT INTO products
  (id, name, slug, description, price_in_cents, discount_percent, is_active, sku, brand, category_id, created_at, updated_at)
VALUES

  -- ────────────────────────────────────────────────────────────
  -- TECNOLOGÍA — Celulares
  -- ────────────────────────────────────────────────────────────
  (
    'b1000000-0000-4000-8000-000000000001',
    'Samsung Galaxy A54 5G',
    'samsung-galaxy-a54-5g',
    'Smartphone con pantalla Super AMOLED de 6.4", procesador Exynos 1380, cámara triple de 50 MP, batería de 5000 mAh y carga rápida de 25W. Resistencia al agua IP67.',
    34999, 5, TRUE, 'SAMS-GA54-BLK-128', 'Samsung',
    'a1000000-0000-4000-8000-000000000002', NOW(), NOW()
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'Xiaomi Redmi Note 13 Pro',
    'xiaomi-redmi-note-13-pro',
    'Teléfono con pantalla AMOLED 120Hz de 6.67", cámara de 200 MP con OIS, procesador Snapdragon 7s Gen 2, batería de 5100 mAh y carga turbo de 67W.',
    24999, 0, TRUE, 'XIAO-RN13P-BLK-256', 'Xiaomi',
    'a1000000-0000-4000-8000-000000000002', NOW(), NOW()
  ),

  -- TECNOLOGÍA — Laptops
  (
    'b1000000-0000-4000-8000-000000000003',
    'MacBook Air 13" M2',
    'macbook-air-13-m2',
    'Laptop ultradelgada con chip Apple M2, pantalla Liquid Retina de 13.6", 8 GB de RAM unificada, 256 GB SSD y hasta 18 horas de autonomía.',
    109999, 0, TRUE, 'APPL-MBA13-M2-8-256', 'Apple',
    'a1000000-0000-4000-8000-000000000003', NOW(), NOW()
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'ASUS VivoBook 15 OLED',
    'asus-vivobook-15-oled',
    'Laptop con pantalla OLED FHD de 15.6", procesador AMD Ryzen 5 7530U, 8 GB RAM DDR4, 512 GB SSD NVMe y Windows 11 Home.',
    64999, 8, TRUE, 'ASUS-VB15-R5-8-512', 'ASUS',
    'a1000000-0000-4000-8000-000000000003', NOW(), NOW()
  ),

  -- TECNOLOGÍA — Accesorios
  (
    'b1000000-0000-4000-8000-000000000005',
    'Teclado Mecánico Redragon K552 Kumara',
    'teclado-mecanico-redragon-k552',
    'Teclado mecánico TKL 87 teclas con switches Blue, retroiluminación LED roja, anti-fantasma completo y estructura de aluminio. Cable USB trenzado.',
    4499, 0, TRUE, 'REDR-K552-BLU-TKL', 'Redragon',
    'a1000000-0000-4000-8000-000000000004', NOW(), NOW()
  ),
  (
    'b1000000-0000-4000-8000-000000000006',
    'Mouse Logitech MX Master 3S',
    'mouse-logitech-mx-master-3s',
    'Ratón inalámbrico ergonómico con sensor 8000 DPI, scroll MagSpeed electromagnético silencioso, 7 botones programables y batería para 70 días.',
    8999, 10, TRUE, 'LOGI-MXM3S-GRY', 'Logitech',
    'a1000000-0000-4000-8000-000000000004', NOW(), NOW()
  ),

  -- TECNOLOGÍA — Audio
  (
    'b1000000-0000-4000-8000-000000000007',
    'Audífonos Sony WH-1000XM5',
    'audifonos-sony-wh-1000xm5',
    'Auriculares over-ear con cancelación de ruido líder (8 micrófonos, procesador HD QN1), 30 horas de batería y audio de alta resolución 360 Reality Audio.',
    29999, 12, TRUE, 'SONY-WH1000XM5-BLK', 'Sony',
    'a1000000-0000-4000-8000-000000000005', NOW(), NOW()
  ),

  -- ────────────────────────────────────────────────────────────
  -- MICROEMPRESA — Ropa
  -- ────────────────────────────────────────────────────────────
  (
    'b2000000-0000-4000-8000-000000000001',
    'Camiseta Bordada Artesanal Floral',
    'camiseta-bordada-artesanal-floral',
    'Camiseta 100% algodón peinado con bordado floral hecho a mano en hilo de seda. Diseño exclusivo, talla única ajustable. Producción local responsable.',
    2800, 0, TRUE, 'MC-CBAF-BLC-TU', 'Manos Creadoras',
    'a2000000-0000-4000-8000-000000000002', NOW(), NOW()
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'Bolso de Cuero Artesanal Tote',
    'bolso-cuero-artesanal-tote',
    'Bolso tipo tote en cuero genuino curtido al vegetal, costura a mano, herrajes en latón, forro de lino natural y bolsillo con cierre. Capacidad para laptop 13".',
    8500, 0, TRUE, 'MC-BCAT-CAF-UN', 'Manos Creadoras',
    'a2000000-0000-4000-8000-000000000002', NOW(), NOW()
  ),

  -- MICROEMPRESA — Cosméticos
  (
    'b2000000-0000-4000-8000-000000000003',
    'Crema Facial Hidratante de Rosa Mosqueta',
    'crema-facial-hidratante-rosa-mosqueta',
    'Crema con aceite de rosa mosqueta, aloe vera orgánico y vitamina E. Sin parabenos ni sulfatos. Hidrata, regenera y mejora el tono de la piel. 50 ml.',
    1950, 0, TRUE, 'NC-CFHRM-50ML', 'NaturaCo',
    'a2000000-0000-4000-8000-000000000003', NOW(), NOW()
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    'Sérum Vitamina C + Ácido Hialurónico 30 ml',
    'serum-vitamina-c-acido-hialuronico-30ml',
    'Sérum con 15% de vitamina C estabilizada, ácido hialurónico y extracto de té verde. Ilumina el tono, reduce manchas y previene el envejecimiento.',
    2400, 5, TRUE, 'NC-SVCH-30ML', 'NaturaCo',
    'a2000000-0000-4000-8000-000000000003', NOW(), NOW()
  ),

  -- MICROEMPRESA — Artesanías
  (
    'b2000000-0000-4000-8000-000000000005',
    'Aretes de Tagua Pintados a Mano',
    'aretes-tagua-pintados-mano',
    'Aretes en tagua (marfil vegetal) tallada y pintada a mano. Diseños geométricos en colores tierra. Peso ligero, hipoalergénicos. Incluye estuche de regalo.',
    1200, 0, TRUE, 'AT-ATPM-GEO-MIX', 'Artesanías Tagua',
    'a2000000-0000-4000-8000-000000000004', NOW(), NOW()
  ),
  (
    'b2000000-0000-4000-8000-000000000006',
    'Vela Aromática de Soya con Esencias Naturales',
    'vela-aromatica-soya-esencias-naturales',
    'Vela artesanal de cera de soya 100% natural, mecha de algodón y esencias botánicas (lavanda, eucalipto o vainilla). ~45 horas de quemado. Frasco de vidrio reciclado.',
    1550, 0, TRUE, 'VA-VASEN-SOY-LAV', 'Candle Art',
    'a2000000-0000-4000-8000-000000000004', NOW(), NOW()
  ),

  -- ────────────────────────────────────────────────────────────
  -- TIENDA DE BARRIO — Lácteos
  -- ────────────────────────────────────────────────────────────
  (
    'b3000000-0000-4000-8000-000000000001',
    'Leche Entera Alpina 1 Litro',
    'leche-entera-alpina-1l',
    'Leche entera pasteurizada y homogeneizada. Rica en calcio, vitamina D y proteínas. Caja individual de 1 litro. Conservar en lugar fresco y seco.',
    120, 0, TRUE, 'ALPI-LE-1L', 'Alpina',
    'a3000000-0000-4000-8000-000000000002', NOW(), NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    'Huevos Rojos AA — Cartón x12',
    'huevos-rojos-aa-carton-x12',
    'Huevos frescos de gallina clasificación AA. Cartón por 12 unidades. Ricos en proteínas y vitaminas B. Conservar refrigerado entre 4–8 °C.',
    350, 0, TRUE, 'HUER-RAA-C12', 'Huevos del Campo',
    'a3000000-0000-4000-8000-000000000002', NOW(), NOW()
  ),

  -- TIENDA DE BARRIO — Bebidas
  (
    'b3000000-0000-4000-8000-000000000003',
    'Gaseosa Coca-Cola 1.5 Litros',
    'gaseosa-coca-cola-1-5l',
    'Bebida gaseosa Coca-Cola sabor original en presentación de 1.5 litros. Botella plástica retornable. Sirva fría para mejor sabor.',
    180, 0, TRUE, 'CCO-COL-1500ML', 'Coca-Cola',
    'a3000000-0000-4000-8000-000000000003', NOW(), NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000004',
    'Agua Cristal Sin Gas 600 ml',
    'agua-cristal-sin-gas-600ml',
    'Agua purificada sin gas en botella plástica de 600 ml. Proceso de purificación por osmosis inversa. Ideal para hidratarse en movimiento.',
    80, 0, TRUE, 'CRIS-SG-600ML', 'Cristal',
    'a3000000-0000-4000-8000-000000000003', NOW(), NOW()
  ),

  -- TIENDA DE BARRIO — Snacks
  (
    'b3000000-0000-4000-8000-000000000005',
    'Papas Margarita Clásicas 155 g',
    'papas-margarita-clasicas-155g',
    'Papas fritas en hojuelas con sal. Presentación familiar de 155 g. Elaboradas con papas seleccionadas y aceite vegetal. Sin gluten.',
    120, 0, TRUE, 'MARG-CLS-155G', 'Margarita',
    'a3000000-0000-4000-8000-000000000004', NOW(), NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000006',
    'Chocolatina Jet Leche 16 g',
    'chocolatina-jet-leche-16g',
    'Chocolatina de leche con álbum de figuritas coleccionables. 16 g por unidad. Elaborada con cacao colombiano. Producto favorito de todas las generaciones.',
    50, 0, TRUE, 'JET-CHO-LEC-16G', 'Jet',
    'a3000000-0000-4000-8000-000000000004', NOW(), NOW()
  ),

  -- TIENDA DE BARRIO — Aseo
  (
    'b3000000-0000-4000-8000-000000000007',
    'Jabón Protex Original 110 g',
    'jabon-protex-original-110g',
    'Jabón antibacterial que elimina el 99.9% de las bacterias. Barra de 110 g con fragancia fresca. Uso diario para toda la familia.',
    100, 0, TRUE, 'PROT-ORI-110G', 'Protex',
    'a3000000-0000-4000-8000-000000000005', NOW(), NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000008',
    'Detergente Ariel Doble Poder 500 g',
    'detergente-ariel-doble-poder-500g',
    'Detergente en polvo con tecnología de limpieza profunda. Remueve manchas difíciles desde el primer lavado. Para ropa blanca y de color. 500 g.',
    220, 0, TRUE, 'ARIE-DP-500G', 'Ariel',
    'a3000000-0000-4000-8000-000000000005', NOW(), NOW()
  ),

  -- TIENDA DE BARRIO — Canasta Familiar
  (
    'b3000000-0000-4000-8000-000000000009',
    'Arroz Diana Extra Blanco 500 g',
    'arroz-diana-extra-blanco-500g',
    'Arroz blanco grano largo tipo extra. Libre de impurezas, cocción uniforme y suelta. Bolsa de 500 g. Rico en carbohidratos.',
    95, 0, TRUE, 'DIAN-EXT-500G', 'Diana',
    'a3000000-0000-4000-8000-000000000006', NOW(), NOW()
  ),
  (
    'b3000000-0000-4000-8000-00000000000a',
    'Aceite Vegetal Oleocali 1 Litro',
    'aceite-vegetal-oleocali-1l',
    'Aceite vegetal de palma refinado, sin colesterol y libre de grasas trans. Botella de 1 litro. Ideal para freír, saltear y preparar aderezos.',
    250, 0, TRUE, 'OLEO-VEG-1L', 'Oleocali',
    'a3000000-0000-4000-8000-000000000006', NOW(), NOW()
  )

ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- SECCIÓN 4: ATRIBUTOS DE PRODUCTO
-- ================================================================

INSERT INTO product_attributes (id, key, value, product_id) VALUES

  -- Samsung Galaxy A54
  (gen_random_uuid(), 'Pantalla',       '6.4" Super AMOLED FHD+ 120Hz',   'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Procesador',     'Exynos 1380 (5 nm)',              'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'RAM',            '6 GB',                            'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Almacenamiento', '128 GB + microSD expandible',     'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Cámara',         '50 MP + 12 MP + 5 MP',           'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Batería',        '5000 mAh — Carga 25W',           'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Conectividad',   '5G, Wi-Fi 6, Bluetooth 5.3',     'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Resistencia',    'IP67 — agua y polvo',            'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Color',          'Awesome Graphite (Negro)',        'b1000000-0000-4000-8000-000000000001'),

  -- Xiaomi Redmi Note 13 Pro
  (gen_random_uuid(), 'Pantalla',       '6.67" AMOLED 120Hz',             'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Procesador',     'Snapdragon 7s Gen 2 (4 nm)',     'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'RAM',            '8 GB LPDDR4X',                   'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Almacenamiento', '256 GB UFS 2.2',                 'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Cámara',         '200 MP + 8 MP + 2 MP (OIS)',     'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Batería',        '5100 mAh — Turbo Charge 67W',    'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Color',          'Midnight Black',                  'b1000000-0000-4000-8000-000000000002'),

  -- MacBook Air M2
  (gen_random_uuid(), 'Chip',           'Apple M2 — 8 núcleos CPU',       'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Pantalla',       '13.6" Liquid Retina 500 nits',   'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'RAM',            '8 GB unificada',                  'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Almacenamiento', '256 GB SSD NVMe',                'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Batería',        'Hasta 18 horas',                 'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Puertos',        '2x Thunderbolt 4 + MagSafe 3',  'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Color',          'Medianoche',                      'b1000000-0000-4000-8000-000000000003'),

  -- ASUS VivoBook 15 OLED
  (gen_random_uuid(), 'Pantalla',       '15.6" OLED FHD 60Hz 600 nits',  'b1000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'Procesador',     'AMD Ryzen 5 7530U',              'b1000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'RAM',            '8 GB DDR4 3200 MHz',             'b1000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'Almacenamiento', '512 GB SSD M.2 NVMe',            'b1000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'GPU',            'AMD Radeon Graphics integrada',   'b1000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'SO',             'Windows 11 Home',                 'b1000000-0000-4000-8000-000000000004'),

  -- Teclado Redragon K552
  (gen_random_uuid(), 'Tipo',           'Mecánico TKL (87 teclas)',        'b1000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Switches',       'Outemu Blue — táctil y clicky',  'b1000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Retroiluminación','LED Roja fija (no RGB)',         'b1000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Anti-fantasma',  'N-Key Rollover completo',        'b1000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Estructura',     'Aluminio + plástico ABS',        'b1000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Conexión',       'USB-A con cable trenzado',       'b1000000-0000-4000-8000-000000000005'),

  -- Mouse Logitech MX Master 3S
  (gen_random_uuid(), 'Sensor',         '8000 DPI MagSpeed',              'b1000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Botones',        '7 botones programables',          'b1000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Conectividad',   'Bluetooth 5 + Logi Bolt USB',    'b1000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Batería',        '70 días con carga completa',     'b1000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Compatibilidad', 'Windows, Mac, Linux',            'b1000000-0000-4000-8000-000000000006'),

  -- Sony WH-1000XM5
  (gen_random_uuid(), 'ANC',            '8 micrófonos — doble procesador','b1000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'Batería',        '30 horas con ANC activo',        'b1000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'Carga rápida',   '3 min → 3 h de reproducción',   'b1000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'Bluetooth',      '5.2 con multipoint (2 devices)', 'b1000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'Peso',           '250 g',                          'b1000000-0000-4000-8000-000000000007'),

  -- Camiseta Bordada
  (gen_random_uuid(), 'Material',       '100% algodón peinado 180 g/m²', 'b2000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Técnica',        'Bordado a mano — hilo de seda', 'b2000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Talla',          'Única ajustable (S–M)',          'b2000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Lavado',         'Frío a mano — no centrifugar',  'b2000000-0000-4000-8000-000000000001'),

  -- Bolso de Cuero
  (gen_random_uuid(), 'Material',       'Cuero genuino curtido vegetal', 'b2000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Forro',          'Lino natural con bolsillo',     'b2000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Herrajes',       'Latón envejecido',              'b2000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Capacidad',      'Laptop hasta 13"',              'b2000000-0000-4000-8000-000000000002'),

  -- Crema Facial
  (gen_random_uuid(), 'Ingrediente',    'Aceite rosa mosqueta 5%',       'b2000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Complementos',   'Aloe vera orgánico + Vit. E',   'b2000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Volumen',        '50 ml',                         'b2000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Sin',            'Parabenos, sulfatos, SLS',      'b2000000-0000-4000-8000-000000000003'),

  -- Sérum Vitamina C
  (gen_random_uuid(), 'Vitamina C',     '15% estabilizada',              'b2000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'Ácido hialurónico','1% bajo peso molecular',      'b2000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'Volumen',        '30 ml',                         'b2000000-0000-4000-8000-000000000004'),

  -- Aretes Tagua
  (gen_random_uuid(), 'Material',       'Tagua — marfil vegetal',        'b2000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Técnica',        'Tallado y pintado a mano',      'b2000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Incluye',        'Estuche de regalo artesanal',   'b2000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Alergénico',     'Hipoalergénico',                'b2000000-0000-4000-8000-000000000005'),

  -- Vela Aromática
  (gen_random_uuid(), 'Cera',           'Soya 100% natural',             'b2000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Mecha',          'Algodón sin zinc',              'b2000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Aroma',          'Lavanda / Eucalipto / Vainilla','b2000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Quemado',        'Aprox. 45 horas',               'b2000000-0000-4000-8000-000000000006'),

  -- Leche Alpina
  (gen_random_uuid(), 'Tipo',           'Entera pasteurizada',           'b3000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Volumen',        '1 Litro',                       'b3000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'Calcio',         '300 mg por vaso (200 ml)',      'b3000000-0000-4000-8000-000000000001'),

  -- Huevos AA
  (gen_random_uuid(), 'Clasificación',  'AA — Rojo',                     'b3000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Unidades',       '12 por cartón',                 'b3000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'Conservación',   'Refrigerado 4–8 °C',            'b3000000-0000-4000-8000-000000000002'),

  -- Coca-Cola
  (gen_random_uuid(), 'Sabor',          'Original',                      'b3000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Volumen',        '1.5 Litros',                    'b3000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'Envase',         'Botella plástica retornable',   'b3000000-0000-4000-8000-000000000003'),

  -- Agua Cristal
  (gen_random_uuid(), 'Tipo',           'Purificada sin gas',            'b3000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'Volumen',        '600 ml',                        'b3000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'Proceso',        'Osmosis inversa',               'b3000000-0000-4000-8000-000000000004'),

  -- Papas Margarita
  (gen_random_uuid(), 'Sabor',          'Clásico — sal',                 'b3000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Peso neto',      '155 g',                         'b3000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'Sin gluten',     'Sí',                            'b3000000-0000-4000-8000-000000000005'),

  -- Chocolatina Jet
  (gen_random_uuid(), 'Sabor',          'Leche con cacao colombiano',    'b3000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Peso',           '16 g',                          'b3000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'Incluye',        'Figurita coleccionable',        'b3000000-0000-4000-8000-000000000006'),

  -- Jabón Protex
  (gen_random_uuid(), 'Tipo',           'Antibacterial — barra',         'b3000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'Peso',           '110 g',                         'b3000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'Protección',     'Elimina el 99.9% de bacterias', 'b3000000-0000-4000-8000-000000000007'),

  -- Detergente Ariel
  (gen_random_uuid(), 'Presentación',   'En polvo',                      'b3000000-0000-4000-8000-000000000008'),
  (gen_random_uuid(), 'Peso neto',      '500 g',                         'b3000000-0000-4000-8000-000000000008'),
  (gen_random_uuid(), 'Uso',            'Ropa blanca y de color',        'b3000000-0000-4000-8000-000000000008'),

  -- Arroz Diana
  (gen_random_uuid(), 'Tipo',           'Extra — grano largo',           'b3000000-0000-4000-8000-000000000009'),
  (gen_random_uuid(), 'Peso neto',      '500 g',                         'b3000000-0000-4000-8000-000000000009'),
  (gen_random_uuid(), 'Cocción',        'Uniforme y suelta',             'b3000000-0000-4000-8000-000000000009'),

  -- Aceite Oleocali
  (gen_random_uuid(), 'Tipo',           'Vegetal de palma refinado',     'b3000000-0000-4000-8000-00000000000a'),
  (gen_random_uuid(), 'Volumen',        '1 Litro',                       'b3000000-0000-4000-8000-00000000000a'),
  (gen_random_uuid(), 'Grasas trans',   'Sin grasas trans',              'b3000000-0000-4000-8000-00000000000a');


-- ================================================================
-- SECCIÓN 5: IMÁGENES DE PRODUCTO
-- ================================================================

INSERT INTO product_images (id, url, alt_text, sort_order, is_primary, product_id) VALUES

  -- TECNOLOGÍA
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Galaxy+A54',        'Samsung Galaxy A54 5G — frente',        0, TRUE,  'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Galaxy+A54+Back',   'Samsung Galaxy A54 5G — trasera',       1, FALSE, 'b1000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Redmi+Note+13',     'Xiaomi Redmi Note 13 Pro',               0, TRUE,  'b1000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=MacBook+Air+M2',    'MacBook Air 13" M2 — cerrada',          0, TRUE,  'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=MacBook+Air+Open',  'MacBook Air 13" M2 — abierta',          1, FALSE, 'b1000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=VivoBook+15+OLED',  'ASUS VivoBook 15 OLED',                  0, TRUE,  'b1000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Redragon+K552',     'Teclado Mecánico Redragon K552',         0, TRUE,  'b1000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=MX+Master+3S',      'Mouse Logitech MX Master 3S',            0, TRUE,  'b1000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Sony+WH1000XM5',    'Audífonos Sony WH-1000XM5 — frente',    0, TRUE,  'b1000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Sony+XM5+Plegado',  'Audífonos Sony WH-1000XM5 — plegados', 1, FALSE, 'b1000000-0000-4000-8000-000000000007'),

  -- MICROEMPRESA
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Camiseta+Bordada',  'Camiseta Bordada Artesanal Floral',      0, TRUE,  'b2000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Bordado+Detalle',   'Detalle del bordado a mano',             1, FALSE, 'b2000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Bolso+Cuero+Tote',  'Bolso de Cuero Artesanal Tote',          0, TRUE,  'b2000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Bolso+Interior',    'Interior del bolso de cuero',            1, FALSE, 'b2000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Crema+Rosa+Mosqueta','Crema Facial de Rosa Mosqueta 50ml',   0, TRUE,  'b2000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Serum+VitC',        'Sérum Vitamina C + Hialurónico 30ml',   0, TRUE,  'b2000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Aretes+Tagua',      'Aretes de Tagua Pintados a Mano',        0, TRUE,  'b2000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Vela+Soya',         'Vela Aromática de Soya — frasco',        0, TRUE,  'b2000000-0000-4000-8000-000000000006'),

  -- TIENDA DE BARRIO
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Leche+Alpina+1L',   'Leche Entera Alpina 1 Litro',            0, TRUE,  'b3000000-0000-4000-8000-000000000001'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Huevos+AA+x12',     'Huevos Rojos AA — Cartón x12',           0, TRUE,  'b3000000-0000-4000-8000-000000000002'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Coca-Cola+1.5L',    'Gaseosa Coca-Cola 1.5 Litros',           0, TRUE,  'b3000000-0000-4000-8000-000000000003'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Agua+Cristal+600ml','Agua Cristal Sin Gas 600 ml',            0, TRUE,  'b3000000-0000-4000-8000-000000000004'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Papas+Margarita',   'Papas Margarita Clásicas 155 g',         0, TRUE,  'b3000000-0000-4000-8000-000000000005'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Chocolatina+Jet',   'Chocolatina Jet Leche 16 g',             0, TRUE,  'b3000000-0000-4000-8000-000000000006'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Jabon+Protex',      'Jabón Protex Original 110 g',            0, TRUE,  'b3000000-0000-4000-8000-000000000007'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Ariel+500g',        'Detergente Ariel Doble Poder 500 g',     0, TRUE,  'b3000000-0000-4000-8000-000000000008'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Arroz+Diana+500g',  'Arroz Diana Extra Blanco 500 g',         0, TRUE,  'b3000000-0000-4000-8000-000000000009'),
  (gen_random_uuid(), 'https://placehold.co/800x800?text=Aceite+Oleocali+1L','Aceite Vegetal Oleocali 1 Litro',        0, TRUE,  'b3000000-0000-4000-8000-00000000000a');


-- ================================================================
-- SECCIÓN 6: INVENTARIO
-- Stock calibrado por tipo de negocio:
--   Tecnología  → moderado (producto de alto valor)
--   Microempresa → bajo     (producción artesanal limitada)
--   Barrio      → alto      (rotación diaria masiva)
-- ================================================================

INSERT INTO inventory (id, total_stock, reserved_stock, low_stock_threshold, product_id) VALUES

  -- TECNOLOGÍA
  (gen_random_uuid(), 45,  0, 5,  'b1000000-0000-4000-8000-000000000001'), -- Galaxy A54
  (gen_random_uuid(), 30,  0, 5,  'b1000000-0000-4000-8000-000000000002'), -- Redmi Note 13
  (gen_random_uuid(), 20,  0, 3,  'b1000000-0000-4000-8000-000000000003'), -- MacBook Air M2
  (gen_random_uuid(), 25,  0, 3,  'b1000000-0000-4000-8000-000000000004'), -- ASUS VivoBook
  (gen_random_uuid(), 80,  0, 10, 'b1000000-0000-4000-8000-000000000005'), -- Teclado Redragon
  (gen_random_uuid(), 60,  0, 8,  'b1000000-0000-4000-8000-000000000006'), -- Mouse Logitech
  (gen_random_uuid(), 35,  0, 5,  'b1000000-0000-4000-8000-000000000007'), -- Sony WH-1000XM5

  -- MICROEMPRESA
  (gen_random_uuid(), 12,  0, 2,  'b2000000-0000-4000-8000-000000000001'), -- Camiseta Bordada
  (gen_random_uuid(), 8,   0, 2,  'b2000000-0000-4000-8000-000000000002'), -- Bolso de Cuero
  (gen_random_uuid(), 50,  0, 5,  'b2000000-0000-4000-8000-000000000003'), -- Crema Facial
  (gen_random_uuid(), 40,  0, 5,  'b2000000-0000-4000-8000-000000000004'), -- Sérum Vitamina C
  (gen_random_uuid(), 25,  0, 3,  'b2000000-0000-4000-8000-000000000005'), -- Aretes Tagua
  (gen_random_uuid(), 20,  0, 3,  'b2000000-0000-4000-8000-000000000006'), -- Vela Aromática

  -- TIENDA DE BARRIO
  (gen_random_uuid(), 200, 0, 20, 'b3000000-0000-4000-8000-000000000001'), -- Leche Alpina
  (gen_random_uuid(), 150, 0, 20, 'b3000000-0000-4000-8000-000000000002'), -- Huevos AA
  (gen_random_uuid(), 120, 0, 15, 'b3000000-0000-4000-8000-000000000003'), -- Coca-Cola
  (gen_random_uuid(), 300, 0, 30, 'b3000000-0000-4000-8000-000000000004'), -- Agua Cristal
  (gen_random_uuid(), 250, 0, 25, 'b3000000-0000-4000-8000-000000000005'), -- Papas Margarita
  (gen_random_uuid(), 500, 0, 50, 'b3000000-0000-4000-8000-000000000006'), -- Chocolatina Jet
  (gen_random_uuid(), 180, 0, 20, 'b3000000-0000-4000-8000-000000000007'), -- Jabón Protex
  (gen_random_uuid(), 160, 0, 20, 'b3000000-0000-4000-8000-000000000008'), -- Detergente Ariel
  (gen_random_uuid(), 400, 0, 40, 'b3000000-0000-4000-8000-000000000009'), -- Arroz Diana
  (gen_random_uuid(), 250, 0, 25, 'b3000000-0000-4000-8000-00000000000a'); -- Aceite Oleocali


COMMIT;

-- ================================================================
-- VERIFICACIÓN RÁPIDA (ejecutar por separado)
-- ================================================================
-- SELECT COUNT(*) FROM categories;        -- esperado: 15
-- SELECT COUNT(*) FROM categories_closure; -- esperado: 26
-- SELECT COUNT(*) FROM products;          -- esperado: 23
-- SELECT COUNT(*) FROM product_attributes; -- esperado: ~80
-- SELECT COUNT(*) FROM product_images;    -- esperado: 28
-- SELECT COUNT(*) FROM inventory;         -- esperado: 23
--
-- Vista precios por sector:
-- SELECT p.name, p.brand, p.price_in_cents / 100.0 AS precio_usd,
--        p.discount_percent, c.name AS categoria
--   FROM products p
--   JOIN categories c ON c.id = p.category_id
--  ORDER BY c.name, p.price_in_cents DESC;
