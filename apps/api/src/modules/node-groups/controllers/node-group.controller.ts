import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NodeGroupService } from '../services/node-group.service';
import { CreateNodeGroupDto } from '../dto/create-node-group.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('node-groups')
@UseGuards(AuthGuard, RolesGuard)
export class NodeGroupController {
  constructor(private readonly nodeGroupService: NodeGroupService) {}

  @Post()
  @Roles('admin', 'operator')
  async createNodeGroup(
    @Body() dto: CreateNodeGroupDto,
    @Request() req: any,
  ) {
    return this.nodeGroupService.createNodeGroup(dto, req.user.id);
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  async listNodeGroups(@Query('clusterId') clusterId?: string) {
    return this.nodeGroupService.listNodeGroups(clusterId);
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  async getNodeGroup(@Param('id') id: string) {
    return this.nodeGroupService.getNodeGroup(id);
  }

  @Put(':id')
  @Roles('admin', 'operator')
  async updateNodeGroup(
    @Param('id') id: string,
    @Body() updates: Partial<CreateNodeGroupDto>,
    @Request() req: any,
  ) {
    return this.nodeGroupService.updateNodeGroup(id, updates, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  async deleteNodeGroup(@Param('id') id: string, @Request() req: any) {
    await this.nodeGroupService.deleteNodeGroup(id, req.user.id);
    return { success: true, message: 'Node group deleted' };
  }

  @Get('cluster/:clusterId/count')
  @Roles('admin', 'operator', 'viewer')
  async countNodeGroups(@Param('clusterId') clusterId: string) {
    const count = await this.nodeGroupService.countNodeGroups(clusterId);
    return { clusterId, count };
  }
}
