import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformProfileDecorations1789120000000 implements MigrationInterface {
  name = 'AddPlatformProfileDecorations1789120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_profile_decoration" (
        "id" SERIAL NOT NULL,
        "avatarFrameId" character varying(40) NOT NULL DEFAULT 'plain',
        "titleId" character varying(40) NOT NULL DEFAULT 'newcomer',
        "badgeId" character varying(40) NOT NULL DEFAULT 'welcome',
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_profile_decoration" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_profile_decoration_user" UNIQUE ("userId"),
        CONSTRAINT "FK_platform_profile_decoration_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_profile_decoration"`);
  }
}
