import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  PLATFORM_BOOKING_QUEUE,
  PlatformJobData,
} from './platform-queue.service';
import { PlatformBookingExecutor } from './platform-booking.executor';

@Processor(PLATFORM_BOOKING_QUEUE)
export class PlatformProcessor extends WorkerHost {
  constructor(private readonly executor: PlatformBookingExecutor) {
    super();
  }

  async process(job: Job<PlatformJobData>): Promise<void> {
    await this.executor.execute(job.data.runId);
  }
}
