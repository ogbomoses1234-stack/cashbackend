import { prisma } from '../config/database';

export class DeviceService {
  static async list(userId: string) {
    return prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  static async block(userId: string, deviceId: string) {
    return prisma.userDevice.update({
      where: { id: deviceId },
      data: { blocked: true },
    });
  }

  static async unblock(userId: string, deviceId: string) {
    return prisma.userDevice.update({
      where: { id: deviceId },
      data: { blocked: false },
    });
  }

  static async remove(userId: string, deviceId: string) {
    await prisma.userDevice.delete({ where: { id: deviceId } });
    return { deleted: true };
  }
}
