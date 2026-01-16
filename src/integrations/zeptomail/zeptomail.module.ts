import { Module } from '@nestjs/common';
import { ZeptomailService } from './zeptomail.service';

@Module({
  providers: [ZeptomailService],
  exports: [ZeptomailService],
})
export class ZeptomailModule {}
