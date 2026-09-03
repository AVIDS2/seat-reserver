import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingRecurrence1788518400000 implements MigrationInterface {
  name = 'AddBookingRecurrence1788518400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD COLUMN "scheduleWeekdays" jsonb NOT NULL DEFAULT '[1,2,3,4,5]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      DROP COLUMN "scheduleWeekdays"
    `);
  }
}
