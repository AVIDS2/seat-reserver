import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingScheduleDates1788691200000 implements MigrationInterface {
  name = 'AddBookingScheduleDates1788691200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD COLUMN "scheduleDates" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      DROP COLUMN "scheduleDates"
    `);
  }
}
