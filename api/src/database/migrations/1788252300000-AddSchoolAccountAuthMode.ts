import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolAccountAuthMode1788252300000 implements MigrationInterface {
  name = 'AddSchoolAccountAuthMode1788252300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_account"
      ADD COLUMN "authMode" character varying(20) NOT NULL DEFAULT 'direct'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_school_account"
      DROP COLUMN "authMode"
    `);
  }
}
