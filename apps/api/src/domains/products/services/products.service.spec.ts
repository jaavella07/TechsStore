import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ProductsService } from './products.service';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Inventory } from '../entities/inventory.entity';

const makeQueryBuilder = () => ({
  select:            jest.fn().mockReturnThis(),
  where:             jest.fn().mockReturnThis(),
  andWhere:          jest.fn().mockReturnThis(),
  orderBy:           jest.fn().mockReturnThis(),
  skip:              jest.fn().mockReturnThis(),
  take:              jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  getCount:          jest.fn(),
  getMany:           jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepo: any;

  beforeEach(async () => {
    productsRepo = {
      createQueryBuilder: jest.fn(),
      findOne:            jest.fn(),
      save:               jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(Category), useValue: {} },
        { provide: getRepositoryToken(Inventory), useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll()', () => {
    it('pagina en 2 pasos: cuenta, obtiene IDs, y luego hidrata relaciones', async () => {
      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(2);
      const idsQb = makeQueryBuilder();
      idsQb.getMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      const dataQb = makeQueryBuilder();
      dataQb.getMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

      productsRepo.createQueryBuilder
        .mockReturnValueOnce(countQb)
        .mockReturnValueOnce(idsQb)
        .mockReturnValueOnce(dataQb);

      const result = await service.findAll({ offset: 0, limit: 12 } as any);

      expect(productsRepo.createQueryBuilder).toHaveBeenCalledTimes(3);
      expect(idsQb.skip).toHaveBeenCalledWith(0);
      expect(idsQb.take).toHaveBeenCalledWith(12);
      expect(dataQb.leftJoinAndSelect).toHaveBeenCalledWith('p.category', 'category');
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('retorna vacío sin ejecutar los pasos de IDs/hidratación cuando total=0', async () => {
      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(0);
      productsRepo.createQueryBuilder.mockReturnValueOnce(countQb);

      const result = await service.findAll({ offset: 0, limit: 12 } as any);

      expect(productsRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 12, totalPages: 0 });
    });
  });
});
