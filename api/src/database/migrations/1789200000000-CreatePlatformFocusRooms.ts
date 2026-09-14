import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformFocusRooms1789200000000 implements MigrationInterface {
  name = 'CreatePlatformFocusRooms1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_focus_room" (
        "id" SERIAL NOT NULL,
        "joinCode" character varying(8) NOT NULL,
        "name" character varying(80) NOT NULL,
        "isPublic" boolean NOT NULL DEFAULT true,
        "shareFocusData" boolean NOT NULL DEFAULT true,
        "workMinutes" integer NOT NULL DEFAULT 25,
        "shortBreakMinutes" integer NOT NULL DEFAULT 5,
        "longBreakMinutes" integer NOT NULL DEFAULT 15,
        "roundsBeforeLongBreak" integer NOT NULL DEFAULT 4,
        "status" character varying(20) NOT NULL DEFAULT 'open',
        "timerStatus" character varying(20) NOT NULL DEFAULT 'idle',
        "phase" character varying(20) NOT NULL DEFAULT 'focus',
        "phaseStartedAt" TIMESTAMP,
        "phaseEndsAt" TIMESTAMP,
        "pausedRemainingSeconds" integer,
        "completedRounds" integer NOT NULL DEFAULT 0,
        "lastActiveAt" TIMESTAMP NOT NULL DEFAULT now(),
        "closedAt" TIMESTAMP,
        "hostUserId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_focus_room" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_focus_room_join_code" UNIQUE ("joinCode"),
        CONSTRAINT "FK_platform_focus_room_host" FOREIGN KEY ("hostUserId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "platform_focus_room_member" (
        "id" SERIAL NOT NULL,
        "isFocused" boolean NOT NULL DEFAULT false,
        "focusSeconds" integer NOT NULL DEFAULT 0,
        "focusStartedAt" TIMESTAMP,
        "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
        "leftAt" TIMESTAMP,
        "roomId" integer NOT NULL,
        "userId" integer NOT NULL,
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_focus_room_member" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_focus_room_member_room_user" UNIQUE ("roomId", "userId"),
        CONSTRAINT "FK_platform_focus_room_member_room" FOREIGN KEY ("roomId") REFERENCES "platform_focus_room"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_platform_focus_room_member_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_focus_room_active" ON "platform_focus_room" ("status", "isPublic", "lastActiveAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_focus_room_member_room" ON "platform_focus_room_member" ("roomId", "leftAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_focus_room_member_room"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_focus_room_active"`,
    );
    await queryRunner.query(`DROP TABLE "platform_focus_room_member"`);
    await queryRunner.query(`DROP TABLE "platform_focus_room"`);
  }
}
