import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength, ValidateNested } from "class-validator";

export class HeartbeatPrinterDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsIn(["online", "offline", "busy", "error"])
  status!: "online" | "offline" | "busy" | "error";
}

export class HeartbeatDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HeartbeatPrinterDto)
  printers!: HeartbeatPrinterDto[];
}

export class ClaimJobDto {
  @IsString()
  @Length(1, 40)
  printerName!: string;
}

export class FailJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  error?: string;
}
