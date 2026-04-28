import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }   from '@nestjs/typeorm';
import { DataSource }           from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './domains/products/services/inventory.service';
import { Inventory } from './domains/products/entities/inventory.entity';


// ── Mock factory para repositorio TypeORM ────────────────────
const mockQueryBuilder = {
  setLock:   jest.fn().mockReturnThis(),
  where:     jest.fn().mockReturnThis(),
  getOne:    jest.fn(),
};

const mockRepo = {
  findOne:              jest.fn(),
  save:                 jest.fn(),
  createQueryBuilder:   jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockDataSource = {
  transaction: jest.fn((cb) => cb({ getRepository: () => mockRepo, save: mockRepo.save })),
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Inventory), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  // ── reserve ───────────────────────────────────────────────
  describe('reserve()', () => {
    it('debe reservar stock cuando hay suficiente disponible', async () => {
      const inventory: Partial<Inventory> = {
        id:            'inv-1',
        totalStock:    100,
        reservedStock: 10,
      };

      mockQueryBuilder.getOne.mockResolvedValue(inventory);
      mockRepo.save.mockResolvedValue({ ...inventory, reservedStock: 15 });

      const result = await service.reserve('prod-1', 5);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reservedStock: 15 }),
      );
      expect(result.reservedStock).toBe(15);
    });

    it('debe lanzar BadRequestException cuando stock insuficiente', async () => {
      const inventory: Partial<Inventory> = {
        totalStock:    10,
        reservedStock: 8, // solo 2 disponibles
      };

      mockQueryBuilder.getOne.mockResolvedValue(inventory);

      await expect(service.reserve('prod-1', 5)).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException cuando no existe inventario', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      await expect(service.reserve('no-existe', 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ── release ───────────────────────────────────────────────
  describe('release()', () => {
    it('debe liberar reserva correctamente', async () => {
      const inventory: Partial<Inventory> = {
        totalStock:    100,
        reservedStock: 10,
      };

      mockQueryBuilder.getOne.mockResolvedValue(inventory);
      mockRepo.save.mockResolvedValue({ ...inventory, reservedStock: 7 });

      const result = await service.release('prod-1', 3);
      expect(result.reservedStock).toBe(7);
    });

    it('no debe dejar reservedStock en negativo', async () => {
      const inventory: Partial<Inventory> = {
        totalStock:    100,
        reservedStock: 2,
      };

      mockQueryBuilder.getOne.mockResolvedValue(inventory);
      mockRepo.save.mockImplementation((inv) => Promise.resolve(inv));

      const result = await service.release('prod-1', 10); // liberar más de lo reservado
      expect(result.reservedStock).toBe(0); // Math.max(0, ...)
    });
  });

  // ── confirmSale ───────────────────────────────────────────
  describe('confirmSale()', () => {
    it('debe descontar del stock total y liberar la reserva', async () => {
      const inventory: Partial<Inventory> = {
        totalStock:    100,
        reservedStock: 5,
      };

      mockQueryBuilder.getOne.mockResolvedValue(inventory);
      mockRepo.save.mockResolvedValue({ ...inventory, totalStock: 97, reservedStock: 2 });

      const result = await service.confirmSale('prod-1', 3);
      expect(result.totalStock).toBe(97);
      expect(result.reservedStock).toBe(2);
    });
  });

  // ── adjust ────────────────────────────────────────────────
  describe('adjust()', () => {
    it('debe rechazar ajuste que resulte en stock negativo', async () => {
      const inventory: Partial<Inventory> = {
        totalStock:    5,
        reservedStock: 0,
      };

      // La transacción invoca el callback que llama al repo
      mockDataSource.transaction.mockImplementation(async (cb) => {
        return cb({
          getRepository: () => ({
            createQueryBuilder: jest.fn().mockReturnValue({
              setLock:  jest.fn().mockReturnThis(),
              where:    jest.fn().mockReturnThis(),
              getOne:   jest.fn().mockResolvedValue(inventory),
            }),
            save: jest.fn(),
          }),
          save: jest.fn(),
        });
      });

      await expect(service.adjust('prod-1', -10)).rejects.toThrow(BadRequestException);
    });
  });

  // ── computed properties ───────────────────────────────────
  describe('Propiedades calculadas de Inventory', () => {
    it('availableStock = totalStock - reservedStock', () => {
      const inv = new Inventory();
      inv.totalStock    = 100;
      inv.reservedStock = 25;
      expect(inv.availableStock).toBe(75);
    });

    it('isLowStock cuando availableStock <= lowStockThreshold', () => {
      const inv = new Inventory();
      inv.totalStock        = 5;
      inv.reservedStock     = 1;
      inv.lowStockThreshold = 5;
      expect(inv.isLowStock).toBe(true);  // 4 <= 5
    });

    it('isOutOfStock cuando availableStock === 0', () => {
      const inv = new Inventory();
      inv.totalStock    = 3;
      inv.reservedStock = 3;
      expect(inv.isOutOfStock).toBe(true);
    });
  });
});
