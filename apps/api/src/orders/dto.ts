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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { COLOR_MODES, PAPER_SIZES } from "../pricing/pricing";

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "printing",
  "printed",
  "completed",
  "cancelled",
  "failed",
] as const;

export class OrderItemDto {
  @IsString()
  fileId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  copies!: number;

  @IsIn(COLOR_MODES)
  colorMode!: "bw" | "color";

  @IsBoolean()
  duplex!: boolean;

  @IsIn(PAPER_SIZES)
  paperSize!: "A4" | "A3";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pageRange?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  pageCount?: number;
}

export class OrderDraftDto {
  @IsString()
  @MaxLength(12)
  storeCode!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class ListOrdersQuery {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
