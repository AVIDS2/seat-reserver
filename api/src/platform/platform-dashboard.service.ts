import { Injectable } from '@nestjs/common';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformRunsService } from './platform-runs.service';
import { PlatformTasksService } from './platform-tasks.service';

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly accounts: PlatformAccountsService,
    private readonly tasks: PlatformTasksService,
    private readonly runs: PlatformRunsService,
  ) {}

  async snapshot(userId: number) {
    const [accounts, tasks, runs] = await Promise.all([
      this.accounts.list(userId),
      this.tasks.list(userId),
      this.runs.list(userId),
    ]);
    return { accounts, tasks, runs };
  }
}
