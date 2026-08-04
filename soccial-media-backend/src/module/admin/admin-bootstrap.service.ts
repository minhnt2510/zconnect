import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/user.entity';
import { UserRole } from '../../common/enum/user-role.enum';
import { UserStatus } from '../../common/enum/user-status.enum';

// Identity admin cu (email + mat khau) da bi lo trong lich su project.
// Moi lan app khoi dong, tu di tru sang identity moi va vo hieu hoa
// mat khau demo cu, de khong can chay seed bang tay (free tier khong co
// one-off job tren Render).
const LEGACY_ADMIN_EMAIL = 'admin@zchat.local';
const DEFAULT_ADMIN_EMAIL = 'admin@zconnect.local';
const DEMO_EMAILS = ['user@zchat.local', 'user2@zchat.local'];

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('AdminMigration');

  constructor(
    @InjectRepository(User, 'mariadb')
    private readonly usersRepo: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.migrateAdminIdentity();
      await this.rotateDemoPasswords();
    } catch (err: any) {
      this.logger.warn(`Admin migration failed: ${err?.message}`);
    }
  }

  private async migrateAdminIdentity() {
    const envPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    const username = String(process.env.ADMIN_USERNAME || 'admin')
      .trim()
      .toLowerCase();
    const email = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
      .trim()
      .toLowerCase();

    let user = await this.usersRepo.findOne({ where: { username } } as any);
    let migrated = false;
    if (!user) {
      const legacy = await this.usersRepo.findOne({
        where: { email: LEGACY_ADMIN_EMAIL } as any,
      });
      if (legacy) {
        user = legacy;
        migrated = true;
      }
    }
    if (!user) {
      user = await this.usersRepo.findOne({ where: { email } } as any);
    }

    if (!user) {
      if (envPassword) {
        const created = this.usersRepo.create({
          email,
          password: await bcrypt.hash(envPassword, 10),
          username,
          fullName: 'Quan tri vien',
          phone: '',
          avatarUrl: '',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await this.usersRepo.save(created);
        this.logger.log(`Created ADMIN account: ${username} / ${email}`);
      } else {
        this.logger.warn(
          'ADMIN account not found and ADMIN_PASSWORD not set - skip creation',
        );
      }
      return;
    }

    // Luon dat lai mat khau khi di tru tu identity cu hoac khi co env
    if (migrated || envPassword) {
      const next = envPassword || crypto.randomBytes(12).toString('base64url');
      user.password = await bcrypt.hash(next, 10);
      if (!envPassword) {
        this.logger.log(`ADMIN password rotated (random): ${next}`);
      }
    }
    user.username = username;
    user.email = email;
    user.fullName = 'Quan tri vien';
    user.role = UserRole.ADMIN;
    user.status = UserStatus.ACTIVE;
    await this.usersRepo.save(user);

    // Xoa bat ky account nao con sot lai voi email cu da bi lo
    const leftovers = await this.usersRepo.find({
      where: { email: LEGACY_ADMIN_EMAIL } as any,
    });
    for (const item of leftovers) {
      if (Number(item.userId) !== Number(user.userId)) {
        await this.usersRepo.delete(item.userId);
        this.logger.log(`Removed leftover account with leaked email ${LEGACY_ADMIN_EMAIL}`);
      }
    }

    if (migrated) {
      this.logger.log(
        `Migrated legacy ADMIN (${LEGACY_ADMIN_EMAIL}) -> ${username} / ${email}`,
      );
    } else if (envPassword) {
      this.logger.log(`ADMIN identity ensured: ${username} / ${email}`);
    }
  }

  private async rotateDemoPasswords() {
    for (const email of DEMO_EMAILS) {
      const envKey = email === DEMO_EMAILS[0] ? 'USER1_PASSWORD' : 'USER2_PASSWORD';
      const envPassword = String(process.env[envKey] || '').trim();
      const user = await this.usersRepo.findOne({ where: { email } } as any);
      if (!user) continue;
      const next = envPassword || crypto.randomBytes(12).toString('base64url');
      user.password = await bcrypt.hash(next, 10);
      await this.usersRepo.save(user);
      if (!envPassword) {
        this.logger.log(`Rotated demo password for ${email}`);
      }
    }
  }
}
