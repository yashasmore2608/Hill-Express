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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  pincodeSchema,
  saveAddressSchema,
  type SaveAddressInput,
} from '@hillexpress/shared';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@Controller()
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get('serviceability')
  @ApiOperation({ summary: 'Is a pincode inside an active delivery zone? (public)' })
  serviceability(@Query('pincode', new ZodPipe(pincodeSchema)) pincode: string) {
    return this.addresses.serviceability(pincode);
  }

  @Get('addresses')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER')
  @ApiOperation({ summary: 'My saved addresses (max 2)' })
  list(@CurrentUser() user: JwtPayload) {
    return this.addresses.list(user.sub);
  }

  @Get('addresses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER')
  @ApiOperation({ summary: 'One saved address (for the edit form)' })
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addresses.get(user.sub, id);
  }

  @Post('addresses')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER')
  @ApiOperation({ summary: 'Add an address — zone resolved from pincode' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(saveAddressSchema)) dto: SaveAddressInput,
  ) {
    return this.addresses.create(user.sub, dto);
  }

  @Patch('addresses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER')
  @ApiOperation({ summary: 'Update an address' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(saveAddressSchema)) dto: SaveAddressInput,
  ) {
    return this.addresses.update(user.sub, id, dto);
  }

  @Delete('addresses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER')
  @ApiOperation({ summary: 'Remove an address (soft delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addresses.remove(user.sub, id);
  }
}
