import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformTenantConstraints1788251400000 implements MigrationInterface {
  name = 'AddPlatformTenantConstraints1788251400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_account"
      ADD CONSTRAINT "UQ_platform_school_account_user_id" UNIQUE ("userId", "id")
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD CONSTRAINT "UQ_platform_booking_task_user_id" UNIQUE ("userId", "id")
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD CONSTRAINT "FK_platform_booking_task_owner_account"
      FOREIGN KEY ("userId", "schoolAccountId")
      REFERENCES "platform_school_account" ("userId", "id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_booking_run"
      ADD CONSTRAINT "FK_platform_booking_run_owner_task"
      FOREIGN KEY ("userId", "taskId")
      REFERENCES "platform_booking_task" ("userId", "id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_booking_run"
      ADD CONSTRAINT "FK_platform_booking_run_owner_account"
      FOREIGN KEY ("userId", "schoolAccountId")
      REFERENCES "platform_school_account" ("userId", "id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_platform_booking_run_active_key"
      ON "platform_booking_run" ("taskId", "runType", "targetDate")
      WHERE "status" IN ('pending', 'running', 'success')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_platform_booking_run_active_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_booking_run" DROP CONSTRAINT "FK_platform_booking_run_owner_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_booking_run" DROP CONSTRAINT "FK_platform_booking_run_owner_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_booking_task" DROP CONSTRAINT "FK_platform_booking_task_owner_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_booking_task" DROP CONSTRAINT "UQ_platform_booking_task_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_school_account" DROP CONSTRAINT "UQ_platform_school_account_user_id"`,
    );
  }
}
