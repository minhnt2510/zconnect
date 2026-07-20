import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserBlockTable1720000000000 implements MigrationInterface {
  name = 'CreateUserBlockTable1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('user_block');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'user_block',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'blockerUserId',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'blockedUserId',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'createdAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'user_block',
        new TableIndex({
          name: 'IDX_user_block_blocker_blocked',
          columnNames: ['blockerUserId', 'blockedUserId'],
          isUnique: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_block');
  }
}
