import { Controller, Get, Module } from "@nestjs/common";
import { VoiceGateway } from "./gateway/voice.gateway.js";

@Controller()
class HealthController {
  constructor(private readonly voiceGateway: VoiceGateway) {}

  @Get("healthz")
  health() {
    return {
      ok: true,
      service: "voice-agent",
      uptimeSeconds: Math.floor(process.uptime()),
      ...this.voiceGateway.getCapacity(),
    };
  }

  @Get("readyz")
  ready() {
    return { ready: true, ...this.voiceGateway.getCapacity() };
  }
}

@Module({
  controllers: [HealthController],
  providers: [VoiceGateway],
})
export class AppModule {}
