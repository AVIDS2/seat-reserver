import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingTaskLocation1788253200000 implements MigrationInterface {
  name = 'AddBookingTaskLocation1788253200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD COLUMN "venueType" character varying(20) NOT NULL DEFAULT 'study_room',
      ADD COLUMN "building" character varying(50) NOT NULL DEFAULT '未指定',
      ADD COLUMN "roomName" character varying(120) NOT NULL DEFAULT '未指定',
      ADD COLUMN "primarySeatLabel" character varying(30)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      DROP COLUMN "primarySeatLabel",
      DROP COLUMN "roomName",
      DROP COLUMN "building",
      DROP COLUMN "venueType"
    `);
  }
}
