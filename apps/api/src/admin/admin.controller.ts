import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assignDriverSchema, type AssignDriverInput } from '@hillexpress/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { ReportsService, type ReportKind } from './reports.service';
import { OrdersService } from '../orders/orders.service';

const rangeSchema = z.coerce.number().int().min(1).max(365).default(30);
const reportKindSchema = z.enum(['orders', 'cod', 'products', 'drivers']);

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly analytics: AnalyticsService,
    private readonly reports: ReportsService,
    private readonly orders: OrdersService,
  ) {}

  @Get('analytics')
  @ApiOperation({ summary: 'KPIs, daily series, status mix, top products, hourly load' })
  getAnalytics(@Query('rangeDays', new ZodPipe(rangeSchema)) rangeDays: number) {
    return this.analytics.overview(rangeDays);
  }

  @Get('dispatch')
  @ApiOperation({ summary: 'Live orders with assignment state — the dispatch board' })
  dispatch() {
    return this.admin.dispatchBoard();
  }

  @Get('orders')
  @ApiOperation({ summary: 'All orders, filterable by status/search (keyset-paginated)' })
  ordersList(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.admin.ordersList({ status, search, cursor });
  }

  @Get('drivers')
  @ApiOperation({ summary: 'Drivers with COD exposure and live load' })
  drivers() {
    return this.admin.drivers();
  }

  @Get('products')
  @ApiOperation({ summary: 'Inventory across stores, low/out filters' })
  products(@Query('filter') filter?: string, @Query('search') search?: string) {
    return this.admin.products({ filter, search });
  }

  @Post('orders/:id/assign')
  @ApiOperation({ summary: 'Assign a driver — COD limit enforced here (FR-A-005)' })
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(assignDriverSchema)) dto: AssignDriverInput,
  ) {
    return this.orders.adminAssign(user.sub, id, dto.driverId);
  }

  @Get('reports/:kind')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'FR-A-007 — download a CSV report' })
  async report(
    @Param('kind', new ZodPipe(reportKindSchema)) kind: ReportKind,
    @Query('rangeDays', new ZodPipe(rangeSchema)) rangeDays: number,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.reports.generate(kind, rangeDays);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM so Excel opens ₹ and Indian names correctly instead of mojibake.
    res.send('﻿' + csv);
  }
}
