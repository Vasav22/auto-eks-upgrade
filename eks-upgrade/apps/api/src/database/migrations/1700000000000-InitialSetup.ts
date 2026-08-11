import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial setup migration template.
 *
 * Migration naming convention: [timestamp]-[DescriptiveName].ts
 * Example: 1700000000000-CreateUsersTable.ts
 *
 * To generate a new migration:
 *   npm run typeorm:migration:generate -- src/database/migrations/MigrationName
 *
 * To create a blank migration:
 *   npm run typeorm:migration:create -- src/database/migrations/MigrationName
 */
export class InitialSetup1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add your migration logic here
    // Example: await queryRunner.query(`CREATE TABLE "users" (...)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add rollback logic here
    // Example: await queryRunner.query(`DROP TABLE "users"`);
  }
}
