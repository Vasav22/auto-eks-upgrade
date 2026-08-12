import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsOptional()
  @IsString()
  code_verifier?: string;
}
