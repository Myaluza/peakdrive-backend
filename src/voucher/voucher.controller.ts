import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { VoucherService } from "./voucher.service";

@Controller('voucher')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post('redeem')
  async redeemVoucher(@Body() body: {code: string; userId: string }) {
    const { code, userId } = body

    return this.voucherService.redeem(code, userId)
  }
}