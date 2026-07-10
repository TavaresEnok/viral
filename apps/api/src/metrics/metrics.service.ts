import { Injectable, type OnModuleInit } from "@nestjs/common";
import { collectDefaultMetrics, register } from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
    get contentType(): string {
        return register.contentType;
    }

    onModuleInit() {
        collectDefaultMetrics({ register });
    }

    getMetrics(): Promise<string> {
        return register.metrics();
    }
}
