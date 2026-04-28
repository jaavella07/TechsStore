import {
  Controller, Get, Post, Body, Patch, Delete,
  Param, Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ProductsService }    from '../services/products.service';
import { InventoryService }   from '../services/inventory.service';
import {
  CreateProductDto, UpdateProductDto, ProductFilterDto,
  CreateCategoryDto, AdjustStockDto,
} from '../dto/product.dto';
import { JwtAuthGuard }       from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard }         from '../../../modules/auth/guards/roles.guard';
import { Roles }              from '../../../modules/auth/decorators/roles.decorator';
import { UserRole }           from '@shared/enums';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService:  ProductsService,
    private readonly inventoryService: InventoryService,
  ) {}

  // ─── PÚBLICAS ────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar productos con filtros y paginación' })
  findAll(@Query() filters: ProductFilterDto) {
    return this.productsService.findAll(filters);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar todas las categorías activas' })
  findCategories() {
    return this.productsService.findAllCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalle de producto por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Ver detalle de producto por slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // ─── ADMIN ───────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Crear producto con stock inicial' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Actualizar producto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Desactivar producto (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  // ─── INVENTARIO (ADMIN) ───────────────────────────────────

  @Get(':id/inventory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Ver inventario de un producto' })
  getInventory(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getByProductId(id);
  }

  @Patch(':id/inventory/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Ajuste manual de stock (+/-)' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjust(id, dto.quantity, dto.reason);
  }

  // ─── CATEGORÍAS (ADMIN) ───────────────────────────────────

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Crear categoría' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }
}
