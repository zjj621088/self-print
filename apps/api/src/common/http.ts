import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("http");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      res.status(status).json({ statusCode: status, message });
      return;
    }

    const code =
      typeof exception === "object" && exception && "code" in exception
        ? String((exception as { code: unknown }).code)
        : "";
    if (code === "LIMIT_FILE_SIZE") {
      res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message: "文件不能超过 20MB" });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: "服务器错误" });
  }
}

export function isPrismaUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}
