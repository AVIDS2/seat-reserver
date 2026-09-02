import 'dotenv/config';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../database/data-source';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { StatusEntity } from '../statuses/infrastructure/persistence/relational/entities/status.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

async function seed(): Promise<void> {
  const dataSource: DataSource = await AppDataSource.initialize();
  const roles = dataSource.getRepository(RoleEntity);
  const statuses = dataSource.getRepository(StatusEntity);
  const users = dataSource.getRepository(UserEntity);

  await roles.upsert(
    [
      { id: RoleEnum.user, name: 'User' },
      { id: RoleEnum.admin, name: 'Admin' },
    ],
    ['id'],
  );
  await statuses.upsert(
    [
      { id: StatusEnum.active, name: 'Active' },
      { id: StatusEnum.inactive, name: 'Inactive' },
    ],
    ['id'],
  );

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await users.findOne({ where: { email: adminEmail } });
    if (!existing) {
      await users.save(
        users.create({
          email: adminEmail,
          password: await bcrypt.hash(adminPassword, 12),
          firstName: '平台',
          lastName: '管理员',
          role: { id: RoleEnum.admin },
          status: { id: StatusEnum.active },
        }),
      );
    }
  }

  await dataSource.destroy();
}

void seed().catch((error: unknown) => {
  console.error('Platform seed failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
