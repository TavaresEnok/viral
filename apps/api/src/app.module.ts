import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { BrandKitModule } from "./brand-kit/brand-kit.module.js";
import { ClipsModule } from "./clips/clips.module.js";
import { HealthModule } from "./common/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { PrismaService } from "./prisma.service.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { PricingModule } from "./pricing/pricing.module.js";
import { PublishModule } from "./publish/publish.module.js";
import { ExportModule } from "./export/export.module.js";
import { PublicApiModule } from "./public-api/public-api.module.js";
import { QualityModule } from "./quality/quality.module.js";
import { QuotaModule } from "./quota/quota.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: ["../../.env", ".env"],
            isGlobal: true,
        }),
        QueueModule,
        AuditModule,
        AuthModule,
        BrandKitModule,
        ProjectsModule,
        JobsModule,
        ClipsModule,
        SettingsModule,
        QualityModule,
        QuotaModule,
        HealthModule,
        BillingModule,
        PricingModule,
        PublishModule,
        ExportModule,
        PublicApiModule,
        AdminModule,
        MetricsModule,
    ],
    providers: [PrismaService],
})
export class AppModule {}
