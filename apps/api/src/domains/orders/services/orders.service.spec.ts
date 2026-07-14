import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { OrdersService } from './orders.service';
import { Order, OrderItem } from '../entities/order.entity';
import { CartService } from '../../cart/services/cart.service';
import { InventoryService } from '../../products/services/inventory.service';
import { OrderStatus, QueueName, UserRole } from '@shared/enums';

const makeQueryBuilder = () => ({
  setLock:          jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  leftJoin:         jest.fn().mockReturnThis(),
  addSelect:        jest.fn().mockReturnThis(),
  select:           jest.fn().mockReturnThis(),
  where:            jest.fn().mockReturnThis(),
  andWhere:         jest.fn().mockReturnThis(),
  orderBy:          jest.fn().mockReturnThis(),
  skip:             jest.fn().mockReturnThis(),
  take:             jest.fn().mockReturnThis(),
  getOne:           jest.fn(),
  getMany:          jest.fn(),
  getCount:         jest.fn(),
});

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepo: any;
  let managerOrderRepo: any;
  let cartService: any;
  let inventoryService: any;
  let ordersQueue: any;
  let dataSource: any;

  beforeEach(async () => {
    ordersRepo = {
      createQueryBuilder: jest.fn(),
      findAndCount:       jest.fn(),
      findOne:            jest.fn(),
      save:               jest.fn(),
      update:             jest.fn(),
    };

    managerOrderRepo = {
      createQueryBuilder: jest.fn(),
      findOneOrFail:      jest.fn(),
      save:               jest.fn(),
    };

    cartService = {
      getOrCreateCart:     jest.fn(),
      removeAfterPurchase: jest.fn().mockResolvedValue(undefined),
    };

    inventoryService = {
      confirmSale: jest.fn().mockResolvedValue(undefined),
    };

    ordersQueue = { add: jest.fn().mockResolvedValue(undefined) };

    dataSource = {
      transaction: jest.fn((cb) =>
        cb({ getRepository: jest.fn().mockReturnValue(managerOrderRepo) }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(OrderItem), useValue: {} },
        { provide: CartService, useValue: cartService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: DataSource, useValue: dataSource },
        { provide: getQueueToken(QueueName.ORDERS), useValue: ordersQueue },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ── markAsPaid ────────────────────────────────────────────
  describe('markAsPaid()', () => {
    const buildOrder = (status: OrderStatus) => ({
      id:              'order-1',
      orderNumber:     'ORD-20240101-AAAA',
      status,
      totalInCents:    1000,
      user:            { id: 'user-1', email: 'a@a.com', name: 'A' },
      items: [
        {
          product:              { id: 'prod-1' },
          quantity:             2,
          productNameSnapshot:  'Producto 1',
          unitPriceInCents:     500,
          subtotalInCents:      1000,
        },
      ],
    });

    it('marca la orden como PAGADA, confirma venta, limpia carrito y encola job', async () => {
      const qb = makeQueryBuilder();
      qb.getOne.mockResolvedValue({ id: 'order-1' });
      managerOrderRepo.createQueryBuilder.mockReturnValue(qb);
      managerOrderRepo.findOneOrFail.mockResolvedValue(buildOrder(OrderStatus.PENDING));
      managerOrderRepo.save.mockImplementation((o: any) => Promise.resolve(o));

      const result = await service.markAsPaid('sess_123', 'pi_123');

      expect(result.status).toBe(OrderStatus.PAID);
      expect(inventoryService.confirmSale).toHaveBeenCalledWith('prod-1', 2, expect.anything());
      expect(cartService.removeAfterPurchase).toHaveBeenCalledWith('user-1', expect.anything());
      expect(ordersQueue.add).toHaveBeenCalledTimes(1);
      const [, jobData] = ordersQueue.add.mock.calls[0];
      expect(jobData.orderNumber).toBe('ORD-20240101-AAAA');
      expect(jobData.items).toHaveLength(1);
    });

    it('es idempotente: si la orden ya no está PENDING, no reprocesa ni encola', async () => {
      const qb = makeQueryBuilder();
      qb.getOne.mockResolvedValue({ id: 'order-1' });
      managerOrderRepo.createQueryBuilder.mockReturnValue(qb);
      managerOrderRepo.findOneOrFail.mockResolvedValue(buildOrder(OrderStatus.PAID));

      const result = await service.markAsPaid('sess_123', 'pi_123');

      expect(result.status).toBe(OrderStatus.PAID);
      expect(inventoryService.confirmSale).not.toHaveBeenCalled();
      expect(cartService.removeAfterPurchase).not.toHaveBeenCalled();
      expect(ordersQueue.add).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe orden con esa sesión de Stripe', async () => {
      const qb = makeQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      managerOrderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.markAsPaid('sess_no_existe', 'pi_x')).rejects.toThrow(NotFoundException);
      expect(ordersQueue.add).not.toHaveBeenCalled();
    });

    it('si confirmSale falla, la transacción se revierte y nunca se encola el job', async () => {
      const qb = makeQueryBuilder();
      qb.getOne.mockResolvedValue({ id: 'order-1' });
      managerOrderRepo.createQueryBuilder.mockReturnValue(qb);
      managerOrderRepo.findOneOrFail.mockResolvedValue(buildOrder(OrderStatus.PENDING));
      managerOrderRepo.save.mockImplementation((o: any) => Promise.resolve(o));
      inventoryService.confirmSale.mockRejectedValue(new Error('stock error'));

      await expect(service.markAsPaid('sess_123', 'pi_123')).rejects.toThrow('stock error');
      expect(ordersQueue.add).not.toHaveBeenCalled();
    });
  });

  // ── findOne ───────────────────────────────────────────────
  describe('findOne()', () => {
    it('lanza ForbiddenException si un CLIENT intenta ver una orden ajena', async () => {
      const qb = makeQueryBuilder();
      qb.getOne.mockResolvedValue({ id: 'order-1', user: { id: 'other-user' } });
      ordersRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.findOne('order-1', 'user-1', UserRole.CLIENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a ADMIN ver cualquier orden', async () => {
      const qb = makeQueryBuilder();
      qb.getOne.mockResolvedValue({ id: 'order-1', user: { id: 'other-user' } });
      ordersRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOne('order-1', 'admin-1', UserRole.ADMIN);
      expect(result.id).toBe('order-1');
    });
  });

  // ── findAll (proyección AGENT sin PII) ────────────────────
  describe('findAll()', () => {
    const rawOrder = {
      id:             'order-1',
      orderNumber:    'ORD-1',
      status:         OrderStatus.PAID,
      trackingNumber: 'TRK-1',
      createdAt:      new Date(),
      totalInCents:   5000,
      user:           { id: 'user-1', name: 'User', email: 'u@u.com' },
      items: [
        { productNameSnapshot: 'P1', quantity: 1, unitPriceInCents: 100 },
      ],
    };

    it('para role=AGENT no hace addSelect de datos de usuario y proyecta AgentOrderView (sin PII)', async () => {
      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(1);
      const idsQb = makeQueryBuilder();
      idsQb.getMany.mockResolvedValue([{ id: 'order-1' }]);
      const dataQb = makeQueryBuilder();
      dataQb.getMany.mockResolvedValue([rawOrder]);

      ordersRepo.createQueryBuilder
        .mockReturnValueOnce(countQb)
        .mockReturnValueOnce(idsQb)
        .mockReturnValueOnce(dataQb);

      const result = await service.findAll({ page: 1, limit: 10 } as any, UserRole.AGENT);

      expect(dataQb.leftJoin).not.toHaveBeenCalled();
      expect(dataQb.addSelect).not.toHaveBeenCalled();
      expect(result.data[0]).not.toHaveProperty('user');
      expect(result.data[0]).not.toHaveProperty('totalInCents');
      expect(result.data[0]).toEqual({
        orderNumber:    'ORD-1',
        status:         OrderStatus.PAID,
        trackingNumber: 'TRK-1',
        createdAt:      rawOrder.createdAt,
        items: [{ productNameSnapshot: 'P1', quantity: 1, unitPriceInCents: 100 }],
      });
    });

    it('para role=ADMIN sí proyecta datos mínimos de usuario y devuelve la orden completa', async () => {
      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(1);
      const idsQb = makeQueryBuilder();
      idsQb.getMany.mockResolvedValue([{ id: 'order-1' }]);
      const dataQb = makeQueryBuilder();
      dataQb.getMany.mockResolvedValue([rawOrder]);

      ordersRepo.createQueryBuilder
        .mockReturnValueOnce(countQb)
        .mockReturnValueOnce(idsQb)
        .mockReturnValueOnce(dataQb);

      const result = await service.findAll({ page: 1, limit: 10 } as any, UserRole.ADMIN);

      expect(dataQb.leftJoin).toHaveBeenCalledWith('order.user', 'user');
      expect(dataQb.addSelect).toHaveBeenCalledWith(['user.id', 'user.name', 'user.email']);
      expect(result.data[0]).toBe(rawOrder);
    });

    it('retorna vacío sin ejecutar el paso de hidratación cuando total=0', async () => {
      const countQb = makeQueryBuilder();
      countQb.getCount.mockResolvedValue(0);
      ordersRepo.createQueryBuilder.mockReturnValueOnce(countQb);

      const result = await service.findAll({ page: 1, limit: 10 } as any, UserRole.ADMIN);

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
      expect(ordersRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    });
  });
});
