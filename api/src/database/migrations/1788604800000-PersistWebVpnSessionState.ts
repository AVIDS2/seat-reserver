import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersistWebVpnSessionState1788604800000 implements MigrationInterface {
  name = 'PersistWebVpnSessionState1788604800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_service_connection"
      ADD COLUMN "encryptedWebVpnSession" text,
      ADD COLUMN "webVpnSessionUpdatedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_service_connection"
      DROP COLUMN "webVpnSessionUpdatedAt",
      DROP COLUMN "encryptedWebVpnSession"
    `);
  }
}
