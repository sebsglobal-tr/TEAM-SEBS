import { IsString } from 'class-validator';
import { StrongPassword } from '../../common/validators/strong-password.validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @StrongPassword()
  newPassword!: string;
}
