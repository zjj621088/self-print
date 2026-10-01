import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import { JwtAuthGuard, MerchantGuard } from "../auth/guards";
import { CreateAgentTokenDto, CreateStoreDto, PrinterDto, ReplacePricesDto, UpdatePrinterDto, UpdateStoreDto } from "./dto";
import { StoresService } from "./stores.service";

@Controller("public/stores")
export class PublicStoresController {
  constructor(@Inject(StoresService) private readonly stores: StoresService) {}

  @Get(":code")
  get(@Param("code") code: string) {
    return this.stores.publicStore(code);
  }
}

@Controller("merchant")
@UseGuards(JwtAuthGuard, MerchantGuard)
export class MerchantStoresController {
  constructor(@Inject(StoresService) private readonly stores: StoresService) {}

  @Get("stores")
  list(@CurrentUser() user: { sub: string }) {
    return this.stores.list(user.sub);
  }

  @Post("stores")
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateStoreDto) {
    return this.stores.create(user.sub, dto);
  }

  @Get("stores/:id")
  get(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.stores.get(user.sub, id);
  }

  @Patch("stores/:id")
  update(@CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.update(user.sub, id, dto);
  }

  @Get("stores/:id/qr")
  qr(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.stores.qr(user.sub, id);
  }

  @Post("stores/:id/printers")
  addPrinter(@CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: PrinterDto) {
    return this.stores.addPrinter(user.sub, id, dto);
  }

  @Patch("printers/:id")
  updatePrinter(@CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: UpdatePrinterDto) {
    return this.stores.updatePrinter(user.sub, id, dto);
  }

  @Delete("printers/:id")
  removePrinter(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.stores.removePrinter(user.sub, id);
  }

  @Put("stores/:id/prices")
  replacePrices(@CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: ReplacePricesDto) {
    return this.stores.replacePrices(user.sub, id, dto);
  }

  @Post("stores/:id/agent-tokens")
  createToken(
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: CreateAgentTokenDto,
  ) {
    return this.stores.createAgentToken(user.sub, id, dto);
  }

  @Delete("agent-tokens/:id")
  revokeToken(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.stores.revokeAgentToken(user.sub, id);
  }
}
