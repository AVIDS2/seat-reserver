import 'dotenv/config';
import { AppDataSource } from '../database/data-source';

async function migrate(): Promise<void> {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  await AppDataSource.destroy();
}

void migrate().catch((error: unknown) => {
  console.error('Platform migration failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
