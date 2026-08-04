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

type SeedAccount = {
  email: string;
  username: string;
  password: string;
  role: string;
  fullName: string;
  phone?: string;
};

const upsertUser = async (
  userRepo: any,
  account: SeedAccount,
  resetExisting: boolean,
) => {
  const existing = await userRepo.findOne({ where: { email: account.email } as any });
  if (!existing) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    await userRepo.save(
      userRepo.create({
        email: account.email,
        password: hashedPassword,
        username: account.username,
        fullName: account.fullName,
        phone: account.phone || '',
        avatarUrl: '',
        role: account.role,
        status: UserStatus.ACTIVE,
      }),
    );
    return 'created';
  }
  if (resetExisting) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    existing.password = hashedPassword;
    await userRepo.save(existing);
    return 'reset';
  }
  return 'exists';
};

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
    const adminEnvPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    const adminPassword = adminEnvPassword || randomPassword();
    const adminReset = Boolean(adminEnvPassword);
    const adminAccount: SeedAccount = {
      email: String(process.env.ADMIN_EMAIL || 'admin@zchat.local')
        .trim()
        .toLowerCase(),
      username: String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase(),
      password: adminPassword,
      role: UserRole.ADMIN,
      fullName: 'Quan tri vien',
    };

    const adminResult = await upsertUser(userRepo, adminAccount, adminReset);
    if (adminResult === 'created') {
      console.log(
        `Tao tai khoan ADMIN (GIU BI MAT, khong commit): ${adminAccount.email} / ${adminPassword}`,
      );
    } else if (adminResult === 'reset') {
      console.log(
        `Da dat lai mat khau ADMIN (GIU BI MAT, khong commit): ${adminAccount.email} / ${adminPassword}`,
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
      const reset = i === 0 ? Boolean(user1EnvPassword) : Boolean(user2EnvPassword);
      const result = await upsertUser(userRepo, account, reset);
      if (result === 'created') {
        console.log(
          `Tao tai khoan USER demo (GIU BI MAT, khong commit): ${account.email} / ${account.password}`,
        );
      } else if (result === 'reset') {
        console.log(
          `Da dat lai mat khau USER demo (GIU BI MAT, khong commit): ${account.email} / ${account.password}`,
        );
      } else {
        console.log(`Tai khoan ${account.email} da ton tai (mat khau giu nguyen).`);
      }
    }

    const admin = await userRepo.findOne({
      where: { email: adminAccount.email } as any,
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
