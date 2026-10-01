import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setupApp } from "./setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API http://127.0.0.1:${port}/api`);
}

void bootstrap();
