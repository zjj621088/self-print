import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import { CustomerGuard, JwtAuthGuard, MerchantGuard } from "../auth/guards";
import { ListOrdersQuery, OrderDraftDto } from "./dto";
import { OrdersService } from "./orders.service";

@Controller("customer/orders")
@UseGuards(JwtAuthGuard, CustomerGuard)
export class CustomerOrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Post("quote")
  quote(@CurrentUser() user: { sub: string }, @Body() dto: OrderDraftDto) {
    return this.orders.quote(user.sub, dto);
  }

  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() dto: OrderDraftDto) {
    return this.orders.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: { sub: string }, @Query() query: ListOrdersQuery) {
    return this.orders.listForCustomer(user.sub, query);
  }

  @Get(":id")
  get(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.orders.getForCustomer(user.sub, id);
  }

  @Post(":id/mock-pay")
  mockPay(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.orders.mockPay(user.sub, id);
  }
}

@Controller("merchant")
@UseGuards(JwtAuthGuard, MerchantGuard)
export class MerchantOrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: { sub: string }) {
    return this.orders.dashboard(user.sub);
  }

  @Get("orders")
  list(@CurrentUser() user: { sub: string }, @Query() query: ListOrdersQuery) {
    return this.orders.listForMerchant(user.sub, query);
  }

  @Get("orders/:id")
  get(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.orders.getForMerchant(user.sub, id);
  }

  @Post("orders/:id/cancel")
  cancel(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.orders.cancel(user.sub, id);
  }

  @Post("orders/:id/complete")
  complete(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.orders.complete(user.sub, id);
  }

  @Post("orders/:id/reprint")
  reprint(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.orders.reprint(user.sub, id);
  }
}
