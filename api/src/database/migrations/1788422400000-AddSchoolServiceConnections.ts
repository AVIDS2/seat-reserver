import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolServiceConnections1788422400000 implements MigrationInterface {
  name = 'AddSchoolServiceConnections1788422400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD COLUMN "buildingId" character varying(30),
      ADD COLUMN "roomId" character varying(30),
      ADD COLUMN "scheduleMode" character varying(20) NOT NULL DEFAULT 'daily',
      ADD COLUMN "targetDate" date
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      ADD COLUMN "backupSeatLabels" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      CREATE TABLE "platform_school_service_connection" (
        "id" SERIAL NOT NULL,
        "serviceType" character varying(20) NOT NULL,
        "identifier" character varying(40) NOT NULL,
        "encryptedToken" text,
        "authMode" character varying(20) NOT NULL DEFAULT 'webvpn',
        "status" character varying(30) NOT NULL DEFAULT 'active',
        "tokenRefreshedAt" TIMESTAMP,
        "lastVerifiedAt" TIMESTAMP,
        "schoolAccountId" integer NOT NULL,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_school_service_connection" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_service_connection_account_service" UNIQUE ("schoolAccountId", "serviceType"),
        CONSTRAINT "FK_platform_service_connection_account" FOREIGN KEY ("schoolAccountId") REFERENCES "platform_school_account"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_service_connection_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_service_connection_owner_account" FOREIGN KEY ("userId", "schoolAccountId") REFERENCES "platform_school_account"("userId", "id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      INSERT INTO "platform_school_service_connection"
        ("serviceType", "identifier", "encryptedToken", "authMode", "status", "tokenRefreshedAt", "lastVerifiedAt", "schoolAccountId", "userId", "createdAt", "updatedAt")
      SELECT 'study_room', 'cczukaoyan', "encryptedToken", "authMode", "status", "tokenRefreshedAt", "lastVerifiedAt", "id", "userId", "createdAt", "updatedAt"
      FROM "platform_school_account"
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_school_service_connection"`);
    await queryRunner.query(`
      ALTER TABLE "platform_booking_task"
      DROP COLUMN "backupSeatLabels",
      DROP COLUMN "targetDate",
      DROP COLUMN "scheduleMode",
      DROP COLUMN "roomId",
      DROP COLUMN "buildingId"
    `);
  }
}
