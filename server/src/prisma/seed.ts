import { hashPassword } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  console.log('🌱 Запуск сидинга базы данных...');

  // 1. Создание организатора / админа
  const passwordHash = await hashPassword('cfu_secret_2026');
  const adminUser = await prisma.user.upsert({
    where: { email: 'jam@cfuv.ru' },
    update: {},
    create: {
      email: 'jam@cfuv.ru',
      username: 'cfu_admin',
      displayName: 'Оргкомитет КФУ',
      passwordHash,
      role: 'ADMIN',
      bio: 'Официальный аккаунт организаторов Студенческого геймджема КФУ',
      xp: 150,
      level: 5
    }
  });

  // 2. Создание организации Вуза (КФУ)
  const cfuOrg = await prisma.organization.upsert({
    where: { slug: 'cfu' },
    update: {},
    create: {
      slug: 'cfu',
      name: 'Крымский федеральный университет имени В.И. Вернадского',
      shortName: 'КФУ им. В.И. Вернадского',
      description: 'Ведущий научно-образовательный центр Крыма. Организатор ежегодных студенческих геймджемов и хакатонов.',
      website: 'https://cfuv.ru',
      verified: true,
      members: {
        create: {
          userId: adminUser.id,
          role: 'OWNER'
        }
      }
    }
  });

  // 3. Создание CFU Game Jam 2026-2027
  const jam = await prisma.jam.upsert({
    where: { slug: 'cfu-game-jam-2026' },
    update: {},
    create: {
      slug: 'cfu-game-jam-2026',
      title: 'CFU GAME JAM 2026–2027',
      tagline: '72 часа, одна идея и возможность работать в команде.',
      description: 'Придумай, собери и покажи свою игру на геймджеме КФУ — для студентов любых курсов и направлений.',
      rules: '1. Игра должна быть разработана за 72 часа.\n2. Команда от 1 до 5 человек.\n3. Разрешены любые движки (Unity, Godot, Unreal, Defold, WebGL).\n4. Допускаются готовые ассеты со свободной лицензией с указанием авторства.',
      theme: 'Скрытый свет / Hidden Light',
      organizationId: cfuOrg.id,
      organizerId: adminUser.id,
      status: 'RUNNING',
      votingType: 'HYBRID',
      minTeamSize: 1,
      maxTeamSize: 5,
      regStartsAt: new Date('2026-11-01T00:00:00Z'),
      jamStartsAt: new Date('2026-11-20T18:00:00Z'),
      submissionEndsAt: new Date('2026-11-23T18:00:00Z'),
      votingEndsAt: new Date('2026-11-30T23:59:59Z'),
      criteria: {
        create: [
          { name: 'Геймплей', description: 'Увлекательность механик и динамика игры', weight: 1.2, order: 0 },
          { name: 'Графика и стиль', description: 'Художественное оформление, пиксель-арт или 3D', weight: 1.0, order: 1 },
          { name: 'Звуковое оформление', description: 'Музыка, аудиоэффекты, озвучка', weight: 0.8, order: 2 },
          { name: 'Соответствие теме', description: 'Отражение темы джема', weight: 1.5, order: 3 }
        ]
      }
    }
  });

  console.log(`✅ База данных успешно инициализирована!`);
  console.log(`   - Вуз: ${cfuOrg.name} (slug: ${cfuOrg.slug})`);
  console.log(`   - Джем: ${jam.title} (slug: ${jam.slug})`);
  console.log(`   - Админ логин: jam@cfuv.ru / cfu_secret_2026`);
}

main()
  .catch((e) => {
    console.error('Ошибка сидинга:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
