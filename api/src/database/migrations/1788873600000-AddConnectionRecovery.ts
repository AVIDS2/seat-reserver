import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConnectionRecovery1788873600000 implements MigrationInterface {
  name = 'AddConnectionRecovery1788873600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_service_connection"
      ADD COLUMN "lastAttemptAt" TIMESTAMP,
      ADD COLUMN "nextRetryAt" TIMESTAMP,
      ADD COLUMN "retryCount" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_service_connection"
      DROP COLUMN "retryCount",
      DROP COLUMN "nextRetryAt",
      DROP COLUMN "lastAttemptAt"
    `);
  }
}
