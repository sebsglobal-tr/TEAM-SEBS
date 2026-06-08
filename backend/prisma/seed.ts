import { PrismaClient, UserRole, TaskPriority, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@worktrack.local' },
    update: {},
    create: {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@worktrack.local',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Sistem Yöneticisi',
    },
  });

  const itDept = await prisma.department.upsert({
    where: { name: 'Bilgi Teknolojileri' },
    update: {},
    create: {
      name: 'Bilgi Teknolojileri',
      description: 'Yazılım geliştirme ve IT operasyonları',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: 'İnsan Kaynakları' },
    update: {},
    create: {
      name: 'İnsan Kaynakları',
      description: 'İK ve personel yönetimi',
    },
  });

  const managerHash = await bcrypt.hash('Manager123!', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@worktrack.local' },
    update: {},
    create: {
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'manager@worktrack.local',
      passwordHash: managerHash,
      role: UserRole.MANAGER,
      departmentId: itDept.id,
      position: 'IT Müdürü',
    },
  });

  await prisma.department.update({
    where: { id: itDept.id },
    data: { managerId: manager.id },
  });

  const employeeHash = await bcrypt.hash('Employee123!', 12);
  const employees = await Promise.all([
    prisma.user.upsert({
      where: { email: 'ayse.demir@worktrack.local' },
      update: {},
      create: {
        firstName: 'Ayşe',
        lastName: 'Demir',
        email: 'ayse.demir@worktrack.local',
        passwordHash: employeeHash,
        role: UserRole.EMPLOYEE,
        departmentId: itDept.id,
        position: 'Frontend Geliştirici',
      },
    }),
    prisma.user.upsert({
      where: { email: 'mehmet.kaya@worktrack.local' },
      update: {},
      create: {
        firstName: 'Mehmet',
        lastName: 'Kaya',
        email: 'mehmet.kaya@worktrack.local',
        passwordHash: employeeHash,
        role: UserRole.EMPLOYEE,
        departmentId: itDept.id,
        position: 'Backend Geliştirici',
      },
    }),
    prisma.user.upsert({
      where: { email: 'zeynep.arslan@worktrack.local' },
      update: {},
      create: {
        firstName: 'Zeynep',
        lastName: 'Arslan',
        email: 'zeynep.arslan@worktrack.local',
        passwordHash: employeeHash,
        role: UserRole.EMPLOYEE,
        departmentId: hrDept.id,
        position: 'İK Uzmanı',
      },
    }),
  ]);

  let devTeam = await prisma.team.findFirst({
    where: { name: 'Geliştirme Ekibi', departmentId: itDept.id },
  });
  if (!devTeam) {
    devTeam = await prisma.team.create({
      data: {
        name: 'Geliştirme Ekibi',
        departmentId: itDept.id,
        managerId: manager.id,
      },
    });
  }

  for (const emp of employees.slice(0, 2)) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: devTeam.id, userId: emp.id } },
      update: {},
      create: { teamId: devTeam.id, userId: emp.id },
    });
  }

  // Görevleri her seferinde yeniden oluştur
  await prisma.task.deleteMany({});
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Dashboard UI geliştirmesi',
        description: 'Admin ve çalışan panellerinin responsive tasarımı, kart bileşenleri ve grafik entegrasyonu',
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        assignedToId: employees[0].id,
        createdById: manager.id,
        departmentId: itDept.id,
        estimatedMinutes: 480,
        completionPercent: 35,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.create({
      data: {
        title: 'API entegrasyon testleri',
        description: 'Work session, agent endpoint ve raporlama servislerinin test kapsamı',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.ASSIGNED_TO_EMPLOYEE,
        assignedToId: employees[1].id,
        createdById: manager.id,
        departmentId: itDept.id,
        estimatedMinutes: 240,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.create({
      data: {
        title: 'Personel onboarding dokümanı',
        description: 'Yeni çalışan oryantasyon materyali hazırlama, KVKK bilgilendirme formu',
        priority: TaskPriority.LOW,
        status: TaskStatus.SUBMITTED,
        assignedToId: employees[2].id,
        createdById: superAdmin.id,
        departmentId: hrDept.id,
        estimatedMinutes: 120,
        completionPercent: 85,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.create({
      data: {
        title: 'Performans değerlendirme sistemi',
        description: 'Q2 çeyrek değerlendirme modülü, hedef takip ve geri bildirim arayüzü',
        priority: TaskPriority.URGENT,
        status: TaskStatus.POOL,
        assignedToId: employees[1].id,
        createdById: manager.id,
        departmentId: itDept.id,
        estimatedMinutes: 600,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.create({
      data: {
        title: 'Maaş bordro raporu',
        description: 'Haziran ayı maaş bordro verilerinin hazırlanması ve onay akışı',
        priority: TaskPriority.HIGH,
        status: TaskStatus.MANAGER_APPROVED,
        assignedToId: employees[0].id,
        createdById: superAdmin.id,
        departmentId: hrDept.id,
        estimatedMinutes: 180,
        completionPercent: 100,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  await prisma.taskComment.create({
    data: {
      taskId: tasks[0].id,
      userId: employees[0].id,
      message: 'Ana layout tamamlandı, kart bileşenleri üzerinde çalışıyorum.',
    },
  });

  const todayStart = new Date();
  todayStart.setHours(9, 0, 0, 0);

  // Oturum verilerini temizle ve yeniden oluştur
  await prisma.activityEvent.deleteMany({});
  await prisma.break.deleteMany({});
  await prisma.heartbeat.deleteMany({});
  await prisma.workSession.deleteMany({});
  const session1 = await prisma.workSession.create({
    data: {
      userId: employees[0].id,
      startedAt: todayStart,
      endedAt: new Date(todayStart.getTime() + 2 * 60 * 60 * 1000),
      totalActiveSeconds: 5400,
      totalIdleSeconds: 900,
      totalBreakSeconds: 600,
      totalLockedSeconds: 300,
      status: 'ENDED',
    },
  });

  const session2 = await prisma.workSession.create({
    data: {
      userId: employees[1].id,
      startedAt: new Date(todayStart.getTime() + 30 * 60 * 1000),
      totalActiveSeconds: 3600,
      totalIdleSeconds: 600,
      totalBreakSeconds: 300,
      status: 'ACTIVE',
    },
  });

  await prisma.user.update({
    where: { id: employees[0].id },
    data: { currentStatus: 'WORK_SESSION_ENDED', lastActiveAt: new Date() },
  });

  await prisma.user.update({
    where: { id: employees[1].id },
    data: { currentStatus: 'ONLINE_ACTIVE', lastActiveAt: new Date() },
  });

  await prisma.activityEvent.createMany({
    data: [
      { userId: employees[0].id, workSessionId: session1.id, type: 'SESSION_START', timestamp: todayStart },
      { userId: employees[0].id, workSessionId: session1.id, type: 'SESSION_END', timestamp: new Date(todayStart.getTime() + 2 * 60 * 60 * 1000) },
      { userId: employees[1].id, workSessionId: session2.id, type: 'SESSION_START', timestamp: new Date(todayStart.getTime() + 30 * 60 * 1000) },
    ],
  });

  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'idle_threshold_minutes' },
      update: {},
      create: { key: 'idle_threshold_minutes', value: '10' },
    }),
    prisma.setting.upsert({
      where: { key: 'heartbeat_interval_seconds' },
      update: {},
      create: { key: 'heartbeat_interval_seconds', value: '30' },
    }),
    prisma.setting.upsert({
      where: { key: 'offline_threshold_minutes' },
      update: {},
      create: { key: 'offline_threshold_minutes', value: '3' },
    }),
  ]);

  console.log('Seed completed!');
  console.log('');
  console.log('Test accounts:');
  console.log('  Super Admin: admin@worktrack.local / Admin123!');
  console.log('  Manager:     manager@worktrack.local / Manager123!');
  console.log('  Employee:    ayse.demir@worktrack.local / Employee123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
