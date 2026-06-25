import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!request.user) {
      throw new ForbiddenException('Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
    }
    const { user } = request;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { status: true, deletedAt: true },
    });

    if (!dbUser || dbUser.deletedAt || dbUser.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Hesabınız pasif durumda. Lütfen yöneticinizle iletişime geçin.');
    }

    return true;
  }
}
