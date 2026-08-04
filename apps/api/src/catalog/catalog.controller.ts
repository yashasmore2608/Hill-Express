import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { productsQuerySchema, type ProductsQueryInput } from '@hillexpress/shared';
import { ZodPipe } from '../common/zod.pipe';
import { CatalogService } from './catalog.service';
import { StoresService } from './stores.service';

/**
 * Public reads — browsing needs no login (sign-in happens at checkout).
 * These are the hottest endpoints in the system; Redis caching keyed
 * store:{id}:* lands here when Redis is configured.
 */
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly stores: StoresService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('stores')
  @ApiOperation({ summary: 'Serviceable stores (optionally filtered by pincode)' })
  listStores(@Query('pincode') pincode?: string) {
    return this.stores.list(pincode);
  }

  @Get('stores/:id')
  @ApiOperation({ summary: 'Store summary with ETA teaser' })
  getStore(@Param('id') id: string) {
    return this.stores.get(id);
  }

  @Get('stores/:id/categories')
  @ApiOperation({ summary: 'Categories with live product counts' })
  categories(@Param('id') id: string) {
    return this.catalog.categories(id);
  }

  @Get('stores/:id/products')
  @ApiOperation({ summary: 'Products — keyset-paginated, filter by category or search' })
  products(
    @Param('id') id: string,
    @Query(new ZodPipe(productsQuerySchema)) q: ProductsQueryInput,
  ) {
    return this.catalog.products(id, q);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Single product' })
  product(@Param('id') id: string) {
    return this.catalog.product(id);
  }
}
