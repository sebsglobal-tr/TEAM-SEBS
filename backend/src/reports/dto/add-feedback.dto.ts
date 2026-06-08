import { IsString } from 'class-validator';

export class AddFeedbackDto {
  @IsString()
  message!: string;
}
