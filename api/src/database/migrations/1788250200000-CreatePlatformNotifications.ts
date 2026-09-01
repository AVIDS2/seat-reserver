import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformNotifications1788250200000 implements MigrationInterface {
  name = 'CreatePlatformNotifications1788250200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_notification" (
        "id" SERIAL NOT NULL,
        "kind" character varying(30) NOT NULL,
        "title" character varying(160) NOT NULL,
        "body" character varying(500) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'unread',
        "actionUrl" character varying(120),
        "readAt" TIMESTAMP,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_notification" PRIMARY KEY ("id"),
        CONSTRAINT "FK_platform_notification_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_notification_user_status" ON "platform_notification" ("userId", "status", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_notification_user_status"`,
    );
    await queryRunner.query(`DROP TABLE "platform_notification"`);
  }
}
