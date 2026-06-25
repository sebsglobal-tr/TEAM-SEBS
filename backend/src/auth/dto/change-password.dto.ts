import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır' })
  newPassword!: string;
}
