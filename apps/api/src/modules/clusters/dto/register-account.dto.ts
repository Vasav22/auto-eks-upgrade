import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class RegisterAccountDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'accountName must contain only alphanumeric characters and hyphens',
  })
  accountName: string;

  @IsString()
  @IsNotEmpty()
  accessKeyId: string;

  @IsString()
  @IsNotEmpty()
  secretAccessKey: string;

  @IsString()
  @IsOptional()
  roleArn?: string;

  @IsString()
  @IsOptional()
  externalId?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central|northeast|southeast|southwest|northwest)-[1-3]$/, {
    message: 'Invalid AWS region format',
  })
  defaultRegion?: string;
}
