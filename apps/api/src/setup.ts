import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/http";

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
