import { Controller, Get, Query } from '@nestjs/common';
import { PricingService, PricingResponse, CostEstimate } from './pricing.service.js';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  getPricingTiers(): PricingResponse {
    return this.pricingService.getPricingTiers();
  }

  @Get('estimate')
  estimateCost(
    @Query('projectDurationMinutes') projectDurationMinutes: string = '0',
    @Query('rendersCount') rendersCount: string = '0',
  ): CostEstimate {
    return this.pricingService.estimateMonthlyCost(
      parseInt(projectDurationMinutes, 10),
      parseInt(rendersCount, 10),
    );
  }
}
