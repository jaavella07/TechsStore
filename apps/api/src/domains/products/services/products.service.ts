import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { slugify }          from '../../../common/utils/slugify.util';

import { Product }           from '../entities/product.entity';
import { Category }          from '../entities/category.entity';
import { Inventory }         from '../entities/inventory.entity';
import {
  CreateProductDto, UpdateProductDto,
  ProductFilterDto, CreateCategoryDto,
} from '../dto/product.dto';
import { PaginatedResult }   from '@shared/interfaces';
import { PaginationDto } from '../../users/dto/user.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,

    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,

    private readonly dataSource: DataSource,
  ) {}

  //  Crear producto 
  async create(dto: CreateProductDto): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      const slug = await this.generateUniqueSlug(dto.name);

      const product = manager.create(Product, {
        ...dto,
        slug,
        category: dto.categoryId ? { id: dto.categoryId } as Category : undefined,
      });

      const saved = await manager.save(Product, product);

      // Crear inventario inicial
      const inventory = manager.create(Inventory, {
        product: saved,
        totalStock: dto.initialStock ?? 0,
        reservedStock: 0,
      });
      await manager.save(Inventory, inventory);

      this.logger.log(`Producto creado: ${saved.name} (${saved.id})`);
      return saved;
    });
  }

  //  Listado con filtros (paginación en dos pasos para evitar N+1 con joins one-to-many)
  async findAll(filters: ProductFilterDto): Promise<PaginatedResult<Product>> {
    const { offset = 0, limit = 12, search, categoryId, brand, minPrice, maxPrice, sortBy } = filters;

    const applyFilters = (qb: ReturnType<typeof this.productsRepo.createQueryBuilder>) => {
      qb.where('p.isActive = true');
      // Filtrar por FK directa evita JOIN en la query de IDs → sin SELECT DISTINCT → SQL válido
      if (categoryId) qb.andWhere('p.category_id = :categoryId', { categoryId });
      if (search)     qb.andWhere('(p.name ILIKE :search OR p.description ILIKE :search OR p.brand ILIKE :search)', { search: `%${search}%` });
      if (brand)      qb.andWhere('p.brand ILIKE :brand', { brand: `%${brand}%` });
      if (minPrice)   qb.andWhere('p.priceInCents >= :minPrice', { minPrice });
      if (maxPrice)   qb.andWhere('p.priceInCents <= :maxPrice', { maxPrice });
      return qb;
    };

    const applySort = (qb: ReturnType<typeof this.productsRepo.createQueryBuilder>) => {
      switch (sortBy) {
        case 'price_asc':  return qb.orderBy('p.priceInCents', 'ASC');
        case 'price_desc': return qb.orderBy('p.priceInCents', 'DESC');
        case 'name':       return qb.orderBy('p.name', 'ASC');
        default:           return qb.orderBy('p.createdAt', 'DESC');
      }
    };

    // ── Paso 1: contar ────────────────────────────────────────
    const total      = await applyFilters(this.productsRepo.createQueryBuilder('p')).getCount();
    const page       = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    if (total === 0) return { data: [], total, page, limit, totalPages };

    // ── Paso 2: IDs paginados (sin joins de imágenes/inventarios) ──
    const ids = (
      await applySort(
        applyFilters(this.productsRepo.createQueryBuilder('p').select('p.id')),
      )
        .skip(offset)
        .take(limit)
        .getMany()
    ).map(p => p.id);

    if (!ids.length) return { data: [], total, page, limit, totalPages };

    // ── Paso 3: hidratar relaciones para esos IDs ─────────────
    // attributes no se incluye en el listado (solo en findById/findBySlug)
    const data = await applySort(
      this.productsRepo.createQueryBuilder('p')
        .leftJoinAndSelect('p.category',    'category')
        .leftJoinAndSelect('p.images',      'images')
        .leftJoinAndSelect('p.inventories', 'inv')
        .where('p.id IN (:...ids)', { ids }),
    ).getMany();

    return { data, total, page, limit, totalPages };
  }

  //  Ver producto por ID 
  async findById(id: string): Promise<Product> {
    const product = await this.productsRepo.findOne({
      where: { id },
      relations: ['category', 'images', 'attributes', 'inventories'],
    });
    if (!product) throw new NotFoundException(`Producto ${id} no encontrado`);
    return product;
  }

  //  Ver producto por slug 
  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productsRepo.findOne({
      where: { slug, isActive: true },
      relations: ['category', 'images', 'attributes', 'inventories'],
    });
    if (!product) throw new NotFoundException(`Producto '${slug}' no encontrado`);
    return product;
  }

  //  Actualizar producto 
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);

    if (dto.name && dto.name !== product.name) {
      product.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.categoryId) {
      product.category = { id: dto.categoryId } as Category;
    }

    Object.assign(product, dto);
    return this.productsRepo.save(product);
  }

  //  Desactivar producto 
  async remove(id: string): Promise<void> {
    const product = await this.findById(id);
    product.isActive = false;
    await this.productsRepo.save(product);
  }

  //  Crear categoría 
  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const slug = slugify(dto.name);
    const exists = await this.categoriesRepo.findOne({ where: { slug } });
    if (exists) throw new ConflictException(`La categoría '${dto.name}' ya existe`);

    const category = this.categoriesRepo.create({
      ...dto,
      slug,
      parent: dto.parentId ? { id: dto.parentId } as Category : undefined,
    });
    return this.categoriesRepo.save(category);
  }

  //  Listar categorías 
  async findAllCategories(): Promise<Category[]> {
    return this.categoriesRepo.find({
      where: { isActive: true },
      relations: ['children'],
    });
  }

  //  Helper: slug único 
  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    let slug  = slugify(name);
    let count = 0;

    while (true) {
      const candidate = count === 0 ? slug : `${slug}-${count}`;
      const qb = this.productsRepo
        .createQueryBuilder('p')
        .where('p.slug = :slug', { slug: candidate });

      if (excludeId) qb.andWhere('p.id != :excludeId', { excludeId });

      const exists = await qb.getOne();
      if (!exists) return candidate;
      count++;
    }
  }
}
