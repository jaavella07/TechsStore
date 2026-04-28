import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Inventory } from '../entities/inventory.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    private readonly dataSource: DataSource,
  ) {}

  async getByProductId(productId: string): Promise<Inventory> {
    const inv = await this.inventoryRepo.findOne({
      where: { product: { id: productId } },
      relations: ['product'],
    });
    if (!inv) throw new NotFoundException(`Inventario para producto ${productId} no encontrado`);
    return inv;
  }

  /**
   * RESERVAR STOCK
   * SELECT FOR UPDATE necesita una transacción.
   * Si viene manager externo → lo usa. Si no → crea su propia transacción.
   */
  async reserve(productId: string, quantity: number, manager?: EntityManager): Promise<Inventory> {
    const execute = async (mgr: EntityManager): Promise<Inventory> => {
      const inv = await mgr
        .getRepository(Inventory)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.productId = :productId', { productId })
        .getOne();

      if (!inv) throw new NotFoundException(`Inventario no encontrado para producto ${productId}`);

      const available = inv.totalStock - inv.reservedStock;
      if (available < quantity) {
        throw new BadRequestException(
          `Stock insuficiente. Disponible: ${available}, solicitado: ${quantity}`,
        );
      }

      inv.reservedStock += quantity;
      const saved = await mgr.getRepository(Inventory).save(inv);
      this.logger.log(`Stock reservado: producto=${productId} qty=${quantity} reserved=${saved.reservedStock}`);
      return saved;
    };

    return manager ? execute(manager) : this.dataSource.transaction(execute);
  }

  /**
   * LIBERAR RESERVA
   * Llamado cuando expira el carrito o el usuario lo vacía.
   */
  async release(productId: string, quantity: number, manager?: EntityManager): Promise<Inventory> {
    const execute = async (mgr: EntityManager): Promise<Inventory> => {
      const inv = await mgr
        .getRepository(Inventory)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.productId = :productId', { productId })
        .getOne();

      if (!inv) throw new NotFoundException(`Inventario no encontrado para producto ${productId}`);

      inv.reservedStock = Math.max(0, inv.reservedStock - quantity);
      const saved = await mgr.getRepository(Inventory).save(inv);
      this.logger.log(`Reserva liberada: producto=${productId} qty=${quantity}`);
      return saved;
    };

    return manager ? execute(manager) : this.dataSource.transaction(execute);
  }

  /**
   * CONFIRMAR VENTA — llamado por el webhook de pago exitoso.
   * Descuenta del stock total y libera la reserva.
   */
  async confirmSale(productId: string, quantity: number, manager?: EntityManager): Promise<Inventory> {
    const execute = async (mgr: EntityManager): Promise<Inventory> => {
      const inv = await mgr
        .getRepository(Inventory)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.productId = :productId', { productId })
        .getOne();

      if (!inv) throw new NotFoundException(`Inventario no encontrado`);

      inv.totalStock    = Math.max(0, inv.totalStock - quantity);
      inv.reservedStock = Math.max(0, inv.reservedStock - quantity);

      const saved = await mgr.getRepository(Inventory).save(inv);
      this.logger.log(`Venta confirmada: producto=${productId} qty=${quantity} stock restante=${saved.totalStock}`);
      return saved;
    };

    return manager ? execute(manager) : this.dataSource.transaction(execute);
  }

  /**
   * AJUSTE MANUAL DE STOCK (ADMIN)
   * quantity positivo = entrada / negativo = salida manual
   */
  async adjust(productId: string, quantity: number, reason?: string): Promise<Inventory> {
    return this.dataSource.transaction(async (manager) => {
      const inv = await manager
        .getRepository(Inventory)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.productId = :productId', { productId })
        .getOne();

      if (!inv) throw new NotFoundException(`Inventario no encontrado`);

      const newTotal = inv.totalStock + quantity;
      if (newTotal < 0) {
        throw new BadRequestException(
          `El ajuste resultaría en stock negativo. Stock actual: ${inv.totalStock}`,
        );
      }

      inv.totalStock = newTotal;
      const saved = await manager.getRepository(Inventory).save(inv);
      this.logger.log(`Ajuste manual: producto=${productId} delta=${quantity} razón="${reason}" nuevo stock=${saved.totalStock}`);
      return saved;
    });
  }
}