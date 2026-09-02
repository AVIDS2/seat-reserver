import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformTables1788249600000 implements MigrationInterface {
  name = 'CreatePlatformTables1788249600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_school_account" (
        "id" SERIAL NOT NULL,
        "label" character varying(100) NOT NULL,
        "schoolUsername" character varying(100) NOT NULL,
        "encryptedSchoolPassword" text NOT NULL,
        "encryptedToken" text,
        "status" character varying(30) NOT NULL DEFAULT 'active',
        "tokenRefreshedAt" TIMESTAMP,
        "lastVerifiedAt" TIMESTAMP,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_platform_school_account" PRIMARY KEY ("id"),
        CONSTRAINT "FK_platform_school_account_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_school_account_user" ON "platform_school_account" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_booking_task" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "primarySeatId" character varying(30) NOT NULL,
        "backupSeatIds" jsonb NOT NULL DEFAULT '[]',
        "timeCandidates" jsonb NOT NULL,
        "maxAttempts" integer NOT NULL DEFAULT 12,
        "attemptDelaySeconds" double precision NOT NULL DEFAULT 1.2,
        "bookingWindowSeconds" double precision NOT NULL DEFAULT 20,
        "prewarmOffsetSeconds" integer NOT NULL DEFAULT 0,
        "runOffsetSeconds" integer NOT NULL DEFAULT 1,
        "enabled" boolean NOT NULL DEFAULT true,
        "userId" integer NOT NULL,
        "schoolAccountId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_platform_booking_task" PRIMARY KEY ("id"),
        CONSTRAINT "FK_platform_booking_task_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_booking_task_account" FOREIGN KEY ("schoolAccountId") REFERENCES "platform_school_account"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_booking_task_user_enabled" ON "platform_booking_task" ("userId", "enabled")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_booking_task_account" ON "platform_booking_task" ("schoolAccountId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_booking_run" (
        "id" SERIAL NOT NULL,
        "runType" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "targetDate" date NOT NULL,
        "startedAt" TIMESTAMP,
        "finishedAt" TIMESTAMP,
        "message" text,
        "receipt" character varying(120),
        "location" character varying(255),
        "reservedBegin" character varying(30),
        "reservedEnd" character varying(30),
        "httpStatus" integer,
        "responseCode" character varying(30),
        "attemptsUsed" integer NOT NULL DEFAULT 0,
        "taskId" integer NOT NULL,
        "schoolAccountId" integer NOT NULL,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_booking_run" PRIMARY KEY ("id"),
        CONSTRAINT "FK_platform_booking_run_task" FOREIGN KEY ("taskId") REFERENCES "platform_booking_task"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_booking_run_account" FOREIGN KEY ("schoolAccountId") REFERENCES "platform_school_account"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_booking_run_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_booking_run_user_date" ON "platform_booking_run" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_booking_run_task_date" ON "platform_booking_run" ("taskId", "targetDate", "runType")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_invitation" (
        "id" SERIAL NOT NULL,
        "codeHash" character varying(64) NOT NULL,
        "maxUses" integer NOT NULL DEFAULT 1,
        "usedCount" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "createdByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_invitation" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_invitation_code_hash" UNIQUE ("codeHash"),
        CONSTRAINT "FK_platform_invitation_creator" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_invitation"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_booking_run_task_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_booking_run_user_date"`,
    );
    await queryRunner.query(`DROP TABLE "platform_booking_run"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_booking_task_account"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_booking_task_user_enabled"`,
    );
    await queryRunner.query(`DROP TABLE "platform_booking_task"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_school_account_user"`,
    );
    await queryRunner.query(`DROP TABLE "platform_school_account"`);
  }
}
