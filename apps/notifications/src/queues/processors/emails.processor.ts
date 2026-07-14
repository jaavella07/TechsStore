import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { QueueName, JobName } from '@shared/enums';
import { SendOrderEmailJobData } from '@shared/interfaces';
import { MailService } from '../../mail/mail.service';

@Processor(QueueName.EMAILS)
export class EmailsProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailsProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendOrderEmailJobData>): Promise<void> {
    if (job.name === JobName.SEND_ORDER_EMAIL) {
      await this.mailService.sendOrderConfirmationDetailed(job.data);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Email fallido: job ${job.id} — ${error.message}`);
  }
}
