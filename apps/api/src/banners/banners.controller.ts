import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { saveBannerSchema, type SaveBannerInput } from '@hillexpress/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, JwtGuard } from '../auth/jwt.guard';
import { BannersService } from './banners.service';

const activeSchema = z.object({ isActive: z.boolean() });

/** Public feed — browsing needs no login, so neither does the carousel. */
@ApiTags('catalog')
@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'Live promo banners for the home carousel' })
  feed(@Query('storeId') storeId?: string) {
    return this.banners.feed(storeId);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('ADMIN')
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'All banners including scheduled and expired' })
  list() {
    return this.banners.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a banner' })
  create(@Body(new ZodPipe(saveBannerSchema)) dto: SaveBannerInput) {
    return this.banners.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a banner' })
  update(@Param('id') id: string, @Body(new ZodPipe(saveBannerSchema)) dto: SaveBannerInput) {
    return this.banners.update(id, dto);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Toggle a banner on or off' })
  setActive(
    @Param('id') id: string,
    @Body(new ZodPipe(activeSchema)) dto: { isActive: boolean },
  ) {
    return this.banners.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a banner' })
  remove(@Param('id') id: string) {
    return this.banners.remove(id);
  }
}
