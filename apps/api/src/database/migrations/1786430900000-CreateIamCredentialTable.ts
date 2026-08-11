import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIamCredentialTable1786430900000 implements MigrationInterface {
  name = 'CreateIamCredentialTable1786430900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "aws_credentials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "account_id" varchar(20) NOT NULL,
        "account_alias" varchar(128),
        "role_arn" varchar(256) NOT NULL,
        "external_id" varchar(128),
        "last_assumed_at" timestamptz,
        "last_rotated_at" timestamptz,
        "rotation_interval_days" int NOT NULL DEFAULT 90,
        "is_active" boolean NOT NULL DEFAULT true,
        "validation_status" varchar(32) NOT NULL DEFAULT 'UNKNOWN',
        "validation_message" text,
        "validated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_aws_credentials_account_id" UNIQUE ("account_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_aws_credentials_is_active" ON "aws_credentials" ("is_active")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "aws_credentials"`);
  }
}
