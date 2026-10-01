import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { COLOR_MODES, PAPER_SIZES } from "../pricing/pricing";

export class CreateStoreDto {
  @IsString()
  @Length(1, 40, { message: "门店名称需在 1-40 字" })
  name!: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9]{4,12}$/, { message: "进店码需为 4-12 位字母或数字" })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notice?: string;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @Length(1, 40, { message: "门店名称需在 1-40 字" })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notice?: string;

  @IsOptional()
  @IsIn(["active", "inactive"], { message: "门店状态无效" })
  status?: "active" | "inactive";
}

export class PrinterDto {
  @IsString()
  @Length(1, 40, { message: "打印机名称需在 1-40 字" })
  name!: string;

  @IsString()
  @Length(1, 80, { message: "请填写系统打印机名称" })
  systemName!: string;

  @IsOptional()
  @IsBoolean()
  supportsColor?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsDuplex?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  paperSizes?: string;
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  systemName?: string;

  @IsOptional()
  @IsBoolean()
  supportsColor?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsDuplex?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  paperSizes?: string;
}

export class PriceRuleDto {
  @IsIn(PAPER_SIZES)
  paperSize!: "A4" | "A3";

  @IsIn(COLOR_MODES)
  colorMode!: "bw" | "color";

  @IsBoolean()
  duplex!: boolean;

  @IsInt()
  @Min(0)
  @Max(5000)
  pricePerPage!: number;
}

export class ReplacePricesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PriceRuleDto)
  rules!: PriceRuleDto[];
}

export class CreateAgentTokenDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;
}
