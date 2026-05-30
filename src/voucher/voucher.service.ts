import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { createClient } from "@supabase/supabase-js"

@Injectable()
export class VoucherService {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
  async redeem(code: string, userId: string) {
    const sanitizedCode = code.trim().toUpperCase()
    const { data: voucher, error} = await this.supabase
      .from('vouchers')
      .select('*')
      .eq('code', sanitizedCode)
      .single()

    if (error || !voucher) {
      throw new NotFoundException('Voucher code not found or invalid.')
    }

    if (voucher.is_redeemed) {
      throw new BadRequestException('This voucher code has already been redeemed.')
    }

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('premium_until')
      .eq('id', userId)
      .single()

    let baseTime = Date.now()

    if (profile?.premium_until && new Date(profile.premium_until) > new Date()) {
      baseTime = new Date(profile.premium_until).getTime()
    }

    const premiumDaysInMilliseconds = voucher.duration_days * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(baseTime + premiumDaysInMilliseconds);
  }
}