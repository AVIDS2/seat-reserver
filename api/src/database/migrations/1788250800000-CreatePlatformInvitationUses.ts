import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformInvitationUses1788250800000 implements MigrationInterface {
  name = 'CreatePlatformInvitationUses1788250800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_invitation_use" (
        "id" SERIAL NOT NULL,
        "invitationId" integer NOT NULL,
        "userId" integer NOT NULL,
        "usedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_invitation_use" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_invitation_use_invitation_user" UNIQUE ("invitationId", "userId"),
        CONSTRAINT "FK_platform_invitation_use_invitation" FOREIGN KEY ("invitationId") REFERENCES "platform_invitation"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_invitation_use_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_invitation_use_user" ON "platform_invitation_use" ("userId", "usedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_invitation_use_user"`,
    );
    await queryRunner.query(`DROP TABLE "platform_invitation_use"`);
  }
}
