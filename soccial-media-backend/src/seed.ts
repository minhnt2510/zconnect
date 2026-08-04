/**
 * Script seed tao tai khoan mac dinh
 * Chay: npx ts-node src/seed.ts
 *
 * KHONG dat mat khau co dinh trong file nay - repo co the bi clone,
 * mat khau sinh ngau nhien va chi in ra console khi tai khoan duoc tao.
 * Muon dat mat khau cu the, set env: ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD,
 * USER1_PASSWORD, USER2_PASSWORD (xem .env, git da ignore).
 */
import 'dotenv/config';
import 'reflect-metadata';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './module/user/user.entity';
import { UserRole } from './common/enum/user-role.enum';
import { UserStatus } from './common/enum/user-status.enum';
import { Friendship } from './module/friendship/friendship.entity';
import { FriendshipStatus } from './common/enum/friendship-status.enum';
import { Post } from './module/post/post.entity';

const randomPassword = () => crypto.randomBytes(12).toString('base64url');

// Email admin cu bi lo trong lich su project. Account nao con dung email
// nay se duoc di tru sang identity moi va dat lai mat khau ngay khi chay seed.
const LEGACY_ADMIN_EMAIL = 'admin@zchat.local';
const DEFAULT_ADMIN_EMAIL = 'admin@zconnect.local';

type SeedAccount = {
  email: string;
  username: string;
  password: string;
  role: string;
  fullName: string;
  phone?: string;
};

const hash = (plain: string) => bcrypt.hash(plain, 10);

async function upsertAdmin(userRepo: any) {
  const envPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const adminPassword = envPassword || randomPassword();
  const username = String(process.env.ADMIN_USERNAME || 'admin')
    .trim()
    .toLowerCase();
  const email = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase();

  let user = await userRepo.findOne({ where: { username } } as any);
  let migratedLegacy = false;
  if (!user) {
    const legacy = await userRepo.findOne({
      where: { email: LEGACY_ADMIN_EMAIL } as any,
    });
    if (legacy) {
      user = legacy;
      migratedLegacy = true;
    }
  }
  if (!user) {
    user = await userRepo.findOne({ where: { email } } as any);
  }

  if (!user) {
    user = userRepo.create({
      email,
      password: await hash(adminPassword),
      username,
      fullName: 'Quan tri vien',
      phone: '',
      avatarUrl: '',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(user);
    return { status: 'created', password: adminPassword, username, email };
  }

  // Mat khau chi dat lai khi co env, tru truong hop di tru tu identity cu
  // (bat buoc dat lai de vo hieu hoa mat khau da bi lo).
  if (migratedLegacy || envPassword) {
    user.password = await hash(adminPassword);
  }
  user.username = username;
  user.email = email;
  user.fullName = 'Quan tri vien';
  user.role = UserRole.ADMIN;
  user.status = UserStatus.ACTIVE;
  await userRepo.save(user);

  // Xoa bat ky account nao con sot lai voi email cu da bi lo
  const leftovers = await userRepo.find({
    where: { email: LEGACY_ADMIN_EMAIL } as any,
  });
  for (const item of leftovers) {
    if (Number(item.userId) !== Number(user.userId)) {
      await userRepo.delete(item.userId);
    }
  }

  const status = migratedLegacy
    ? 'migrated'
    : envPassword
      ? 'reset'
      : 'exists';
  return {
    status,
    password: migratedLegacy || envPassword ? adminPassword : null,
    username,
    email,
  };
}

async function upsertDemo(
  userRepo: any,
  account: SeedAccount,
  envPassword: string,
): Promise<{ status: string; password: string }> {
  const existing = await userRepo.findOne({
    where: { email: account.email } as any,
  });
  if (!existing) {
    await userRepo.save(
      userRepo.create({
        email: account.email,
        password: await hash(account.password),
        username: account.username,
        fullName: account.fullName,
        phone: account.phone || '',
        avatarUrl: '',
        role: account.role,
        status: UserStatus.ACTIVE,
      }),
    );
    return { status: 'created', password: account.password };
  }

  // Luon dat lai mat khau (env neu co, nguoc lai random) de vo hieu hoa
  // mat khau demo cu co the da bi lo trong lich su project.
  const nextPassword = envPassword || randomPassword();
  existing.password = await hash(nextPassword);
  await userRepo.save(existing);
  return { status: envPassword ? 'reset' : 'rotated', password: nextPassword };
}

const mariadbConfig = () => {
  const url = process.env.DATABASE_URL_MARIA;
  if (url) {
    const parsed = new URL(url);
    const type = url.startsWith('mysql://') ? 'mysql' : 'mariadb';
    return {
      type: type as 'mysql' | 'mariadb',
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      username: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace('/', ''),
      entities: [User, Friendship],
      synchronize: true,
    } as any;
  }
  return {
    type: 'mariadb' as const,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'zalo_app',
    entities: [User, Friendship],
    synchronize: true,
  };
};

const mongoConfig = () => ({
  type: 'mongodb' as const,
  url:
    process.env.DATABASE_URL_MONGO ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/zalo_app',
  entities: [Post],
  synchronize: true,
});

async function seed() {
  console.log('Dang ket noi database...');

  const mariaDataSource = new DataSource(mariadbConfig());
  const mongoDataSource = new DataSource(mongoConfig());

  await mariaDataSource.initialize();
  await mongoDataSource.initialize();
  console.log('Ket noi database thanh cong!');

  const userRepo = mariaDataSource.getRepository(User);
  const friendshipRepo = mariaDataSource.getRepository(Friendship);
  const postRepo = mongoDataSource.getMongoRepository(Post);

  try {
    const adminResult = await upsertAdmin(userRepo);
    if (adminResult.status === 'created') {
      console.log(
        `Tao tai khoan ADMIN (GIU BI MAT, khong commit): ${adminResult.email} / ${adminResult.password}`,
      );
    } else if (adminResult.status === 'migrated') {
      console.log(
        `Da di tru tai khoan ADMIN cu (${LEGACY_ADMIN_EMAIL} bi lo) sang: ${adminResult.username} / ${adminResult.email}`,
      );
      console.log(
        `Mat khau ADMIN da dat lai (GIU BI MAT, khong commit): ${adminResult.password}`,
      );
    } else if (adminResult.status === 'reset') {
      console.log(
        `Da dat lai mat khau ADMIN (GIU BI MAT, khong commit): ${adminResult.email} / ${adminResult.password}`,
      );
    } else {
      console.log(
        'Tai khoan Admin da ton tai (mat khau giu nguyen). Dat env ADMIN_PASSWORD de doi mat khau.',
      );
    }

    const user1EnvPassword = String(process.env.USER1_PASSWORD || '').trim();
    const user2EnvPassword = String(process.env.USER2_PASSWORD || '').trim();
    const demoAccounts: SeedAccount[] = [
      {
        email: 'user@zchat.local',
        username: 'testuser',
        password: user1EnvPassword || randomPassword(),
        role: UserRole.USER,
        fullName: 'Nguoi dung Test',
      },
      {
        email: 'user2@zchat.local',
        username: 'testuser2',
        password: user2EnvPassword || randomPassword(),
        role: UserRole.USER,
        fullName: 'Nguoi dung Test 2',
      },
    ];

    for (let i = 0; i < demoAccounts.length; i++) {
      const account = demoAccounts[i];
      const envPassword = i === 0 ? user1EnvPassword : user2EnvPassword;
      const demoResult = await upsertDemo(userRepo, account, envPassword);
      if (demoResult.status === 'created') {
        console.log(
          `Tao tai khoan USER demo (GIU BI MAT, khong commit): ${account.email} / ${demoResult.password}`,
        );
      } else if (demoResult.status === 'reset') {
        console.log(
          `Da dat lai mat khau USER demo (GIU BI MAT, khong commit): ${account.email} / ${demoResult.password}`,
        );
      } else {
        console.log(
          `Da dat lai mat khau ngau nhien cho ${account.email} (mat khau demo cu da vo hieu hoa): ${demoResult.password}`,
        );
      }
    }

    const admin = await userRepo.findOne({
      where: { email: adminResult.email } as any,
    });
    const user1 = await userRepo.findOne({
      where: { email: demoAccounts[0].email } as any,
    });
    const user2 = await userRepo.findOne({
      where: { email: demoAccounts[1].email } as any,
    });

    const ensureAcceptedFriend = async (a: number, b: number) => {
      const existing = await friendshipRepo.findOne({
        where: [{ userId1: a, userId2: b }, { userId1: b, userId2: a }],
      });

      if (existing) {
        if (existing.status !== FriendshipStatus.ACCEPTED) {
          existing.status = FriendshipStatus.ACCEPTED;
          existing.createdAt = existing.createdAt || new Date();
          await friendshipRepo.save(existing);
        }
        return;
      }

      const friendship = friendshipRepo.create({
        userId1: Math.min(a, b),
        userId2: Math.max(a, b),
        status: FriendshipStatus.ACCEPTED,
        conversationId: '',
        createdAt: new Date(),
      });
      await friendshipRepo.save(friendship);
    };

    if (admin && user1 && user2) {
      await ensureAcceptedFriend(admin.userId, user1.userId);
      await ensureAcceptedFriend(user1.userId, user2.userId);
      console.log('Da seed quan he ban be mau cho demo');
    }

    const totalPosts = await postRepo.count();
    if (totalPosts === 0 && admin && user1 && user2) {
      const now = Date.now();
      const samples = [
        {
          owner: admin,
          content: 'Chao mung ban den voi ZChat!',
          createdAt: new Date(now - 1000 * 60 * 30),
        },
        {
          owner: user1,
          content: 'Hom nay minh vua test xong mobile app.',
          createdAt: new Date(now - 1000 * 60 * 20),
        },
        {
          owner: user2,
          content: 'Ai ranh vao tab ban be ket noi voi minh nhe.',
          createdAt: new Date(now - 1000 * 60 * 10),
        },
      ];

      for (const sample of samples) {
        const post = postRepo.create({
          title: '',
          content: sample.content,
          visibility: 'public',
          mediaUrl: '',
          createdAt: sample.createdAt,
          commentCount: 0,
          interacts: [],
          owner: {
            userId: sample.owner.userId,
            displayName: sample.owner.fullName,
            avatarUrl: sample.owner.avatarUrl || '',
          },
        });
        await postRepo.save(post);
      }
      console.log('Da seed 3 bai viet mau cho bang tin');
    } else {
      console.log('Bo qua seed bai viet (da co du lieu san)');
    }

    console.log('Seed hoan tat!');
  } finally {
    await mariaDataSource.destroy();
    await mongoDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Loi seed:', err);
  process.exit(1);
});
