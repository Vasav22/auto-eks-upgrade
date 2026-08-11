import { IsUUID, IsString, IsOptional, IsArray } from 'class-validator';

export class DiscoverClustersDto {
  @IsUUID()
  accountId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  regions?: string[];
}
