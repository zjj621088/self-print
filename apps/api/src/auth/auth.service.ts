import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { isPrismaUnique } from "../common/http";
import type { JwtPayload } from "../common/types";
import { PrismaService } from "../prisma.service";
import type { MerchantLoginDto, MerchantRegisterDto, MockCustomerLoginDto } from "./dto";

const MERCHANT_TTL = 7 * 24 * 3600;
const CUSTOMER_TTL = 30 * 24 * 3600;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async register(dto: MerchantRegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const merchant = await this.prisma.merchant.create({
        data: { name: dto.name.trim(), phone: dto.phone, passwordHash },
      });
      return this.merchantSession(merchant);
    } catch (error) {
      if (isPrismaUnique(error)) throw new ConflictException("手机号已注册");
      throw error;
    }
  }

  async login(dto: MerchantLoginDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { phone: dto.phone } });
    if (!merchant) throw new UnauthorizedException("手机号或密码错误");
    const ok = await bcrypt.compare(dto.password, merchant.passwordHash);
    if (!ok) throw new UnauthorizedException("手机号或密码错误");
    return this.merchantSession(merchant);
  }

  async me(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new UnauthorizedException("请先登录");
    return { id: merchant.id, name: merchant.name, phone: merchant.phone };
  }

  async mockCustomerLogin(dto: MockCustomerLoginDto) {
    const openId = `mock:${dto.code.trim()}`;
    const customer = await this.prisma.customer.upsert({
      where: { openId },
      create: { openId, nickname: "微信用户" },
      update: {},
    });
    const payload: JwtPayload = { sub: customer.id, role: "customer" };
    return {
      mock: true,
      token: await this.jwt.signAsync(payload, { expiresIn: CUSTOMER_TTL }),
      customer: { id: customer.id, nickname: customer.nickname },
    };
  }

  private async merchantSession(merchant: { id: string; name: string; phone: string }) {
    const payload: JwtPayload = { sub: merchant.id, role: "merchant" };
    return {
      token: await this.jwt.signAsync(payload, { expiresIn: MERCHANT_TTL }),
      merchant: { id: merchant.id, name: merchant.name, phone: merchant.phone },
    };
  }
}
