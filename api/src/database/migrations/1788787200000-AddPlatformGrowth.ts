import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformGrowth1788787200000 implements MigrationInterface {
  name = 'AddPlatformGrowth1788787200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_invitation"
      ADD COLUMN "source" character varying(20) NOT NULL DEFAULT 'admin'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_invitation_creator_source" ON "platform_invitation" ("createdByUserId", "source")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_membership" (
        "id" SERIAL NOT NULL,
        "plan" character varying(20) NOT NULL DEFAULT 'free',
        "proActivatedAt" TIMESTAMP,
        "proExpiresAt" TIMESTAMP,
        "source" character varying(30) NOT NULL DEFAULT 'manual',
        "note" text,
        "userId" integer NOT NULL,
        "grantedByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_membership" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_membership_user" UNIQUE ("userId"),
        CONSTRAINT "FK_platform_membership_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_membership_granted_by" FOREIGN KEY ("grantedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "platform_points_wallet" (
        "id" SERIAL NOT NULL,
        "pointsBalance" integer NOT NULL DEFAULT 0,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_points_wallet" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_points_wallet_user" UNIQUE ("userId"),
        CONSTRAINT "FK_platform_points_wallet_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "platform_points_ledger" (
        "id" SERIAL NOT NULL,
        "amount" integer NOT NULL,
        "balanceAfter" integer NOT NULL,
        "eventType" character varying(40) NOT NULL,
        "eventKey" character varying(160) NOT NULL,
        "description" character varying(200) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "userId" integer NOT NULL,
        "createdByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_points_ledger" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_points_ledger_event_key" UNIQUE ("eventKey"),
        CONSTRAINT "FK_platform_points_ledger_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_points_ledger_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_points_ledger_user_created" ON "platform_points_ledger" ("userId", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_referral" (
        "id" SERIAL NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "qualifiedAt" TIMESTAMP,
        "referrerUserId" integer NOT NULL,
        "referredUserId" integer NOT NULL,
        "invitationId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_referral" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_referral_referred_user" UNIQUE ("referredUserId"),
        CONSTRAINT "FK_platform_referral_referrer" FOREIGN KEY ("referrerUserId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_referral_referred" FOREIGN KEY ("referredUserId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_referral_invitation" FOREIGN KEY ("invitationId") REFERENCES "platform_invitation"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_referral_referrer_status" ON "platform_referral" ("referrerUserId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_pro_request" (
        "id" SERIAL NOT NULL,
        "plan" character varying(20) NOT NULL DEFAULT 'pro',
        "priceCents" integer NOT NULL DEFAULT 2000,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "note" text,
        "handledAt" TIMESTAMP,
        "userId" integer NOT NULL,
        "handledByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_pro_request" PRIMARY KEY ("id"),
        CONSTRAINT "FK_platform_pro_request_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_pro_request_handled_by" FOREIGN KEY ("handledByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_pro_request_user_status" ON "platform_pro_request" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_platform_pro_request_pending_user" ON "platform_pro_request" ("userId") WHERE "status" = 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_platform_pro_request_pending_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_pro_request_user_status"`,
    );
    await queryRunner.query(`DROP TABLE "platform_pro_request"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_referral_referrer_status"`,
    );
    await queryRunner.query(`DROP TABLE "platform_referral"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_points_ledger_user_created"`,
    );
    await queryRunner.query(`DROP TABLE "platform_points_ledger"`);
    await queryRunner.query(`DROP TABLE "platform_points_wallet"`);
    await queryRunner.query(`DROP TABLE "platform_membership"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_invitation_creator_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_invitation" DROP COLUMN "source"`,
    );
  }
}
