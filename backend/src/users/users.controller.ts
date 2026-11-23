import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto, GrantPropertyAccessDto, UpdateUserStatusDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Users & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listByProperty(@CurrentUser() actor: AuthUser, @Query('propertyId') propertyId: string) {
    return this.usersService.listByProperty(actor.id, propertyId);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.createUser(actor.id, dto);
  }

  @Post(':id/properties')
  grantProperty(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: GrantPropertyAccessDto,
  ) {
    return this.usersService.grantPropertyAccess(actor.id, id, dto.propertyId);
  }

  @Delete(':id/properties/:propertyId')
  revokeProperty(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.usersService.revokePropertyAccess(actor.id, id, propertyId);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(actor.id, id, dto);
  }
}
