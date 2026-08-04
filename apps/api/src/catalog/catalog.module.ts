import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { StoresService } from './stores.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, StoresService],
  exports: [CatalogService, StoresService],
})
export class CatalogModule {}
