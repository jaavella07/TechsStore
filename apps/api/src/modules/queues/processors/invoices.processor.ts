import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger }               from '@nestjs/common';
import { InjectRepository }     from '@nestjs/typeorm';
import { Repository }           from 'typeorm';
import { Job }                  from 'bullmq';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs                  from 'fs';
import * as path                from 'path';

import { QueueName, JobName }   from '@shared/enums';
import { Order }                from '../../../domains/orders/entities/order.entity';
import { OrdersService }        from '../../../domains/orders/services/orders.service';

interface InvoiceJobData {
  orderId:     string;
  userEmail:   string;
  userName:    string;
  totalAmount: number;
}

@Processor(QueueName.INVOICES)
export class InvoicesProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicesProcessor.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
  ) {
    super();
  }

  async process(job: Job<InvoiceJobData>): Promise<void> {
    if (job.name === JobName.GENERATE_INVOICE) {
      await this.generateInvoice(job.data);
    }
  }

  private async generateInvoice(data: InvoiceJobData): Promise<void> {
    const { orderId, userName } = data;
    this.logger.log(`Generando factura PDF para orden ${orderId}...`);

    // Cargar la orden con todos sus items
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'user'],
    });

    if (!order) {
      throw new Error(`Orden ${orderId} no encontrada para generar factura`);
    }

    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([595, 842]); // A4 en puntos
    const { width, height } = page.getSize();

    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const COLOR_PRIMARY = rgb(0.10, 0.13, 0.75); // Azul TechsStore
    const COLOR_GRAY    = rgb(0.45, 0.45, 0.45);
    const COLOR_BLACK   = rgb(0, 0, 0);
    const COLOR_LIGHT   = rgb(0.95, 0.95, 0.95);

    let y = height - 60;

    // ── ENCABEZADO ───────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: COLOR_PRIMARY });
    page.drawText('TechsStore', {
      x: 40, y: height - 55,
      size: 28, font: fontBold, color: rgb(1, 1, 1),
    });
    page.drawText('FACTURA / INVOICE', {
      x: 40, y: height - 78,
      size: 11, font: fontNormal, color: rgb(0.85, 0.85, 1),
    });

    // Número de orden (esquina derecha)
    page.drawText(`# ${order.orderNumber}`, {
      x: width - 200, y: height - 55,
      size: 14, font: fontBold, color: rgb(1, 1, 1),
    });
    page.drawText(new Date().toLocaleDateString('es-MX'), {
      x: width - 200, y: height - 75,
      size: 10, font: fontNormal, color: rgb(0.85, 0.85, 1),
    });

    y = height - 130;

    // ── DATOS DEL CLIENTE ────────────────────────────────
    page.drawText('FACTURADO A:', { x: 40, y, size: 9, font: fontBold, color: COLOR_GRAY });
    y -= 18;
    page.drawText(order.user?.name ?? userName, { x: 40, y, size: 13, font: fontBold, color: COLOR_BLACK });
    y -= 16;
    page.drawText(order.user?.email ?? data.userEmail, { x: 40, y, size: 10, font: fontNormal, color: COLOR_GRAY });

    if (order.shippingAddress) {
      y -= 14;
      const addr = order.shippingAddress;
      page.drawText(`${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}`, {
        x: 40, y, size: 10, font: fontNormal, color: COLOR_GRAY,
      });
    }

    y -= 35;

    // ── TABLA DE PRODUCTOS ───────────────────────────────
    // Cabecera de tabla
    page.drawRectangle({ x: 30, y: y - 4, width: width - 60, height: 22, color: COLOR_PRIMARY });
    const headers = [
      { label: 'PRODUCTO',   x: 40 },
      { label: 'CANT.',      x: 350 },
      { label: 'PRECIO',     x: 410 },
      { label: 'SUBTOTAL',   x: 480 },
    ];
    for (const h of headers) {
      page.drawText(h.label, { x: h.x, y: y + 2, size: 9, font: fontBold, color: rgb(1, 1, 1) });
    }
    y -= 26;

    // Filas de productos
    let rowIndex = 0;
    for (const item of order.items) {
      // Fondo alternado en filas
      if (rowIndex % 2 === 0) {
        page.drawRectangle({ x: 30, y: y - 4, width: width - 60, height: 20, color: COLOR_LIGHT });
      }

      const name    = item.productNameSnapshot.length > 40
        ? item.productNameSnapshot.substring(0, 40) + '…'
        : item.productNameSnapshot;
      const price   = `$${(item.unitPriceInCents / 100).toFixed(2)}`;
      const subtotal = `$${(item.subtotalInCents / 100).toFixed(2)}`;

      page.drawText(name,            { x: 40,  y, size: 10, font: fontNormal, color: COLOR_BLACK });
      page.drawText(`${item.quantity}`, { x: 365, y, size: 10, font: fontNormal, color: COLOR_BLACK });
      page.drawText(price,           { x: 410, y, size: 10, font: fontNormal, color: COLOR_BLACK });
      page.drawText(subtotal,        { x: 480, y, size: 10, font: fontBold,   color: COLOR_BLACK });

      y -= 24;
      rowIndex++;
    }

    // ── TOTAL ────────────────────────────────────────────
    y -= 10;
    page.drawLine({ start: { x: 380, y }, end: { x: width - 30, y }, thickness: 1, color: COLOR_GRAY });
    y -= 20;

    page.drawText('TOTAL:', {
      x: 390, y, size: 13, font: fontBold, color: COLOR_PRIMARY,
    });
    page.drawText(`$${(order.totalInCents / 100).toFixed(2)} USD`, {
      x: 455, y, size: 13, font: fontBold, color: COLOR_PRIMARY,
    });

    // ── PIE DE PÁGINA ────────────────────────────────────
    y = 50;
    page.drawLine({ start: { x: 30, y: y + 20 }, end: { x: width - 30, y: y + 20 }, thickness: 0.5, color: COLOR_GRAY });
    page.drawText('Gracias por tu compra en TechsStore · soporte@techsstore.com · www.techsstore.com', {
      x: 40, y: y + 6, size: 8, font: fontNormal, color: COLOR_GRAY,
    });

    // ── GUARDAR PDF ──────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const invoicesDir = path.join(process.cwd(), 'invoices');

    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const fileName = `invoice-${order.orderNumber}.pdf`;
    const filePath = path.join(invoicesDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    // En producción, subirías el buffer a S3/GCS y guardarías la URL pública
    const invoiceUrl = `/invoices/${fileName}`;
    await this.ordersService.updateInvoiceUrl(orderId, invoiceUrl);

    this.logger.log(`✅ Factura generada: ${filePath}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Factura fallida: ${job.id} — ${error.message}`);
  }
}
