import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class RegisterAccountDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'accountName must contain only alphanumeric characters and hyphens',
  })
  accountName: string;

  // Static keys are fully optional.
  // If omitted, the pod uses its ambient IAM credentials (node role / IRSA) to assume roleArn.
  @IsString()
  @IsOptional()
  accessKeyId?: string;

  @IsString()
  @IsOptional()
  secretAccessKey?: string;

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
