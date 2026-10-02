import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "./decorators";
import { AuthService } from "./auth.service";
import { MerchantLoginDto, MerchantRegisterDto, MockCustomerLoginDto } from "./dto";
import { JwtAuthGuard, MerchantGuard } from "./guards";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("merchant/register")
  register(@Body() dto: MerchantRegisterDto) {
    return this.auth.register(dto);
  }

  @Post("merchant/login")
  login(@Body() dto: MerchantLoginDto) {
    return this.auth.login(dto);
  }

  @Get("merchant/me")
  @UseGuards(JwtAuthGuard, MerchantGuard)
  me(@CurrentUser() user: { sub: string }) {
    return this.auth.me(user.sub);
  }

  @Post("customer/mock-login")
  mockCustomer(@Body() dto: MockCustomerLoginDto) {
    return this.auth.mockCustomerLogin(dto);
  }
}
