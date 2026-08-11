import { IsUUID, IsString, IsNumber, Min, Max, IsOptional, IsArray } from 'class-validator';

export class CreateNodeGroupDto {
  @IsUUID()
  clusterId: string;

  @IsString()
  nodeGroupName: string;

  @IsString()
  eksVersion: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  desiredSize: number;

  @IsNumber()
  @Min(1)
  minSize: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  maxSize: number;

  @IsString()
  instanceType: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labels?: string[];
}
