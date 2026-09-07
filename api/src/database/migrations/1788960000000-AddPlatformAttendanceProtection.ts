import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAttendanceProtection1788960000000 implements MigrationInterface {
  name = 'AddPlatformAttendanceProtection1788960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_attendance_setting" (
        "id" SERIAL NOT NULL,
        "autoCancelNoShow" boolean NOT NULL DEFAULT false,
        "graceMinutes" integer NOT NULL DEFAULT 15,
        "leadMinutes" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" integer NOT NULL,
        CONSTRAINT "PK_platform_attendance_setting" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_attendance_setting_user" UNIQUE ("userId"),
        CONSTRAINT "FK_platform_attendance_setting_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "platform_attendance_setting"');
  }
}
