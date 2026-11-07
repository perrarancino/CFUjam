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

  // 2. Создание демо-участников для биржи тимейтов
  const user1 = await prisma.user.upsert({
    where: { email: 'alina@cfuv.ru' },
    update: {},
    create: {
      email: 'alina@cfuv.ru',
      username: 'alina_k',
      displayName: 'Алина Кравец',
      passwordHash,
      role: 'USER',
      bio: 'Геймдизайнер и художник. Люблю нарративные пазлы и сочные пиксельные анимации.',
      skills: ['Геймдизайн', 'Aseprite', 'Pixel Art', 'Godot 4'],
      xp: 2480,
      level: 12
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'danil@cfuv.ru' },
    update: {},
    create: {
      email: 'danil@cfuv.ru',
      username: 'danil_m',
      displayName: 'Данил Морозов',
      passwordHash,
      role: 'USER',
      bio: 'Программист геймплея на Godot / C#. Могу быстро собрать прототип любой механики.',
      skills: ['Godot 4', 'C#', 'Шейдеры', 'Физика 2D'],
      xp: 1840,
      level: 9
    }
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'artem@cfuv.ru' },
    update: {},
    create: {
      email: 'artem@cfuv.ru',
      username: 'artem_r',
      displayName: 'Артём Романов',
      passwordHash,
      role: 'USER',
      bio: 'Unity 3D разработчик, обожаю хорроры и атмосферные визуальные эффекты.',
      skills: ['Unity', 'C#', '3D Graphics', 'Blender'],
      xp: 1200,
      level: 7
    }
  });

  // 3. Создание организации Вуза (КФУ)
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

  // 4. Создание активного джема КФУ
  const jam1 = await prisma.jam.upsert({
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
          { name: 'Соответствие теме', description: 'Отражение темы джема', weight: 1.2, order: 0 },
          { name: 'Геймплей и механики', description: 'Увлекательность механик и динамика игры', weight: 1.0, order: 1 },
          { name: 'Визуальные эффекты и графика', description: 'Художественное оформление и стиль', weight: 1.0, order: 2 },
          { name: 'Звуковое сопровождение и музыка', description: 'Музыка, аудиоэффекты, атмосфера', weight: 0.8, order: 3 },
          { name: 'Сюжет и нарратив', description: 'История, мир и проработка персонажей', weight: 1.0, order: 4 },
          { name: 'Оригинальность и инновации', description: 'Необычный подход и свежие идеи', weight: 1.1, order: 5 }
        ]
      }
    }
  });

  // 5. Создание команд для джема и открытых вакансий
  const team1 = await prisma.team.upsert({
    where: { jamId_name: { jamId: jam1.id, name: 'Лунный садовник' } },
    update: {},
    create: {
      jamId: jam1.id,
      name: 'Лунный садовник',
      direction: '2D Pixel Art Пазл',
      tagline: 'Ищем саунд-дизайнера и композитора для эмбиент-саундтрека ночного сада.',
      isOpen: true,
      leaderId: user1.id,
      members: {
        create: [
          { userId: user1.id, role: 'GAME_DESIGNER' },
          { userId: user2.id, role: 'PROGRAMMER' }
        ]
      }
    }
  });

  const team2 = await prisma.team.upsert({
    where: { jamId_name: { jamId: jam1.id, name: 'Тихий берег' } },
    update: {},
    create: {
      jamId: jam1.id,
      name: 'Тихий берег',
      direction: '3D Хоррор в Unity',
      tagline: 'Ищем 3D левел-дизайнера для проработки локации заброшенного маяка.',
      isOpen: true,
      leaderId: user3.id,
      members: {
        create: [
          { userId: user3.id, role: 'LEADER' }
        ]
      }
    }
  });

  // 6. Создание постов в дневники разработки (Devlogs)
  await prisma.devlogPost.createMany({
    data: [
      {
        jamId: jam1.id,
        teamId: team1.id,
        authorId: user1.id,
        title: 'День 1: Готова базовая механика полива и цикл день/ночь',
        content: 'Привет всем джемерам! Первые 24 часа позади. Мы перенесли проект на Godot 4.3, настроили тайловую карту сада в ночном Крыму и написали шейдер мягкого лунного света. Данил уже запрограммировал систему роста побегов, а Софья нарисовала потрясающие спрайты ночных цветов. Завтра беремся за звуковые эмбиенты!',
        images: ['img/generated/moon-garden-user.png'],
        likesCount: 19
      },
      {
        jamId: jam1.id,
        teamId: team2.id,
        authorId: user3.id,
        title: '3D маяк в Unity: настроили volumetric fog и звук шагов',
        content: 'Всем привет! Наш хоррор-прототип оживает. Собрали сцену скалистого берега с маяком. Самое сложное было оптимизировать объемный туман под WebGL сборку, чтобы игра летала прямо в браузере со стабильными 60 FPS. Скоро выложим первый тестовый билд!',
        images: ['img/generated/quiet-shore.png'],
        likesCount: 14
      }
    ],
    skipDuplicates: true
  });

  // Закрепляем Jam 1 как featured для КФУ
  await prisma.organization.update({
    where: { id: cfuOrg.id },
    data: {
      featuredJamId: jam1.id,
      themeConfig: {
        theme: 'sunny-pixel',
        font: 'Handjet'
      }
    }
  });

  console.log(`✅ База данных успешно инициализирована!`);
  console.log(`   - Вуз: ${cfuOrg.name} (поддомен: cfu.morejam.ru)`);
  console.log(`   - Джем: ${jam1.title} (slug: ${jam1.slug})`);
  console.log(`   - Созданы команды с открытыми вакансиями: «${team1.name}», «${team2.name}»`);
  console.log(`   - Создана стартовая лента дневников разработки (Devlogs)`);
  console.log(`   - Админ: jam@cfuv.ru / cfu_secret_2026`);
}

main()
  .catch((e) => {
    console.error('Ошибка сидинга:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
