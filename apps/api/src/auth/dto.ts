import { IsString, Length, Matches, MaxLength } from "class-validator";

export class MerchantRegisterDto {
  @IsString({ message: "请填写商家名称" })
  @Length(1, 40, { message: "商家名称需在 1-40 字" })
  name!: string;

  @Matches(/^1\d{10}$/, { message: "请输入 11 位手机号" })
  phone!: string;

  @IsString()
  @Length(6, 64, { message: "密码至少 6 位" })
  password!: string;
}

export class MerchantLoginDto {
  @Matches(/^1\d{10}$/, { message: "请输入 11 位手机号" })
  phone!: string;

  @IsString()
  @Length(1, 64)
  password!: string;
}

export class MockCustomerLoginDto {
  @IsString()
  @Length(4, 64, { message: "登录凭证无效" })
  @MaxLength(64)
  code!: string;
}
