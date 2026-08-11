import { IsUUID, IsString, Matches, IsOptional, IsBoolean } from 'class-validator';

export class CreateUpgradeDto {
  @IsUUID()
  clusterId: string;

  @IsString()
  @Matches(/^1\.\d+$/, {
    message: 'targetVersion must be in format 1.x',
  })
  targetVersion: string;

  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
