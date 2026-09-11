import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolCodeToAccounts1789046400000 implements MigrationInterface {
  name = 'AddSchoolCodeToAccounts1789046400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_account"
      ADD COLUMN "schoolCode" character varying(40) NOT NULL DEFAULT 'cczu'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_platform_school_account_user_school"
      ON "platform_school_account" ("userId", "schoolCode")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_school_account_user_school"`,
    );
    await queryRunner.query(`
      ALTER TABLE "platform_school_account"
      DROP COLUMN "schoolCode"
    `);
  }
}
