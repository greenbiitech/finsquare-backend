import { Module } from '@nestjs/common';
import { PsbWaasService } from './psb-waas.service';

@Module({
  providers: [PsbWaasService],
  exports: [PsbWaasService],
})
export class PsbWaasModule {}
