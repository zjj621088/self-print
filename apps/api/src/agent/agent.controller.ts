import { Body, Controller, Get, Inject, Param, Post, StreamableFile, UseGuards } from "@nestjs/common";
import { CurrentAgent } from "../auth/decorators";
import { AgentGuard } from "../auth/guards";
import type { AgentContext } from "../common/types";
import { FilesService } from "../files/files.service";
import { AgentService } from "./agent.service";
import { ClaimJobDto, FailJobDto, HeartbeatDto } from "./dto";

@Controller("agent")
@UseGuards(AgentGuard)
export class AgentController {
  constructor(
    @Inject(AgentService) private readonly agent: AgentService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  @Post("heartbeat")
  heartbeat(@CurrentAgent() agent: AgentContext, @Body() dto: HeartbeatDto) {
    return this.agent.heartbeat(agent, dto);
  }

  @Get("jobs")
  jobs(@CurrentAgent() agent: AgentContext) {
    return this.agent.listJobs(agent);
  }

  @Post("jobs/:id/claim")
  claim(@CurrentAgent() agent: AgentContext, @Param("id") id: string, @Body() dto: ClaimJobDto) {
    return this.agent.claim(agent, id, dto);
  }

  @Post("jobs/:id/printing")
  printing(@CurrentAgent() agent: AgentContext, @Param("id") id: string) {
    return this.agent.markPrinting(agent, id);
  }

  @Post("jobs/:id/done")
  done(@CurrentAgent() agent: AgentContext, @Param("id") id: string) {
    return this.agent.markDone(agent, id);
  }

  @Post("jobs/:id/fail")
  fail(@CurrentAgent() agent: AgentContext, @Param("id") id: string, @Body() dto: FailJobDto) {
    return this.agent.markFailed(agent, id, dto);
  }

  @Get("jobs/:id/file")
  async file(@CurrentAgent() agent: AgentContext, @Param("id") id: string) {
    const file = await this.agent.fileForJob(agent, id);
    const opened = this.files.open(file);
    return new StreamableFile(opened.stream, {
      type: opened.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(opened.originalName)}`,
    });
  }
}
