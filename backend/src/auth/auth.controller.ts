import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    return this.authService.logout(user.sub, body.refreshToken, req.ip, req.headers['user-agent']);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getSessions(user.sub);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  revokeSession(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.authService.revokeSession(user.sub, id);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  revokeAllSessions(@CurrentUser() user: JwtPayload, @Body('currentToken') currentToken?: string) {
    return this.authService.revokeAllSessions(user.sub, currentToken);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
