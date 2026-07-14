import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { CartService } from './cart.service';
import { Cart, CartItem } from '../entities/cart.entity';
import { ProductsService } from '../../products/services/products.service';
import { InventoryService } from '../../products/services/inventory.service';

describe('CartService', () => {
  let service: CartService;
  let cartRepo: any;
  let managerCartItemRepo: any;
  let managerCartRepo: any;
  let productsService: any;
  let inventoryService: any;
  let dataSource: any;

  const mockCart = (items: any[] = []): any => ({
    id: 'cart-1',
    items,
    isExpired: false,
  });

  beforeEach(async () => {
    cartRepo = {
      findOne: jest.fn(),
      create:  jest.fn((data) => data),
      save:    jest.fn((data) => Promise.resolve(data)),
      remove:  jest.fn(),
    };

    managerCartItemRepo = {
      create: jest.fn((data) => data),
      save:   jest.fn((data) => Promise.resolve(data)),
      remove: jest.fn(),
    };

    managerCartRepo = {
      update: jest.fn(),
    };

    productsService = {
      findById: jest.fn(),
    };

    inventoryService = {
      reserve: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn((cb) =>
        cb({
          getRepository: jest.fn((entity) =>
            entity === CartItem ? managerCartItemRepo : managerCartRepo,
          ),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useValue: cartRepo },
        { provide: getRepositoryToken(CartItem), useValue: {} },
        { provide: ProductsService, useValue: productsService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  // ── addItem ───────────────────────────────────────────────
  describe('addItem()', () => {
    it('crea un ítem nuevo y reserva stock dentro de la misma transacción', async () => {
      cartRepo.findOne.mockResolvedValue(mockCart([]));
      productsService.findById.mockResolvedValue({ id: 'prod-1', finalPriceInCents: 500 });

      await service.addItem('user-1', { productId: 'prod-1', quantity: 2 } as any);

      expect(inventoryService.reserve).toHaveBeenCalledWith('prod-1', 2, expect.anything());
      expect(managerCartItemRepo.save).toHaveBeenCalled();
      expect(managerCartRepo.update).toHaveBeenCalledWith('cart-1', expect.objectContaining({ expiresAt: expect.any(Date) }));
    });

    it('si el ítem ya existe, reserva solo la diferencia e incrementa cantidad', async () => {
      const existingItem = { id: 'item-1', product: { id: 'prod-1' }, quantity: 1 };
      cartRepo.findOne.mockResolvedValue(mockCart([existingItem]));
      productsService.findById.mockResolvedValue({ id: 'prod-1', finalPriceInCents: 500 });

      await service.addItem('user-1', { productId: 'prod-1', quantity: 3 } as any);

      expect(inventoryService.reserve).toHaveBeenCalledWith('prod-1', 3, expect.anything());
      expect(existingItem.quantity).toBe(4);
      expect(managerCartItemRepo.save).toHaveBeenCalledWith(existingItem);
    });

    it('si reserve() falla por stock insuficiente, no se guarda ningún CartItem', async () => {
      cartRepo.findOne.mockResolvedValue(mockCart([]));
      productsService.findById.mockResolvedValue({ id: 'prod-1', finalPriceInCents: 500 });
      inventoryService.reserve.mockRejectedValue(new BadRequestException('Stock insuficiente'));

      await expect(
        service.addItem('user-1', { productId: 'prod-1', quantity: 100 } as any),
      ).rejects.toThrow(BadRequestException);

      expect(managerCartItemRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── updateItem ────────────────────────────────────────────
  describe('updateItem()', () => {
    it('reserva la diferencia cuando la cantidad aumenta', async () => {
      const item = { id: 'item-1', product: { id: 'prod-1' }, quantity: 2 };
      cartRepo.findOne.mockResolvedValue(mockCart([item]));

      await service.updateItem('user-1', 'item-1', { quantity: 5 } as any);

      expect(inventoryService.reserve).toHaveBeenCalledWith('prod-1', 3, expect.anything());
      expect(inventoryService.release).not.toHaveBeenCalled();
      expect(item.quantity).toBe(5);
    });

    it('libera la diferencia cuando la cantidad disminuye', async () => {
      const item = { id: 'item-1', product: { id: 'prod-1' }, quantity: 5 };
      cartRepo.findOne.mockResolvedValue(mockCart([item]));

      await service.updateItem('user-1', 'item-1', { quantity: 2 } as any);

      expect(inventoryService.release).toHaveBeenCalledWith('prod-1', 3, expect.anything());
      expect(inventoryService.reserve).not.toHaveBeenCalled();
    });

    it('no reserva ni libera cuando la cantidad no cambia', async () => {
      const item = { id: 'item-1', product: { id: 'prod-1' }, quantity: 3 };
      cartRepo.findOne.mockResolvedValue(mockCart([item]));

      await service.updateItem('user-1', 'item-1', { quantity: 3 } as any);

      expect(inventoryService.reserve).not.toHaveBeenCalled();
      expect(inventoryService.release).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el ítem no existe en el carrito', async () => {
      cartRepo.findOne.mockResolvedValue(mockCart([]));

      await expect(
        service.updateItem('user-1', 'no-existe', { quantity: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeItem ────────────────────────────────────────────
  describe('removeItem()', () => {
    it('libera la reserva completa y elimina el ítem', async () => {
      const item = { id: 'item-1', product: { id: 'prod-1' }, quantity: 4 };
      cartRepo.findOne.mockResolvedValue(mockCart([item]));

      await service.removeItem('user-1', 'item-1');

      expect(inventoryService.release).toHaveBeenCalledWith('prod-1', 4, expect.anything());
      expect(managerCartItemRepo.remove).toHaveBeenCalledWith(item);
    });

    it('lanza NotFoundException si el ítem no existe', async () => {
      cartRepo.findOne.mockResolvedValue(mockCart([]));

      await expect(service.removeItem('user-1', 'no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
