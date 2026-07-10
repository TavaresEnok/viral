import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { getPlanLimits } from "./plans.js";

@Injectable()
export class QuotaService {
    constructor(private readonly prisma: PrismaService) {}

    private monthlyStart() {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Verifica se o usuário pode fazer render de um clip
     */
    async checkClipRenderQuota(
        userId: string,
        _durationSeconds: number = 0,
    ): Promise<boolean> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);
        return quota.monthlyRenders < planLimits.maxRenders;
    }

    /**
     * Verifica se o usuário pode criar um novo projeto
     */
    async checkProjectQuota(userId: string): Promise<boolean> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);
        const monthlyStart = this.monthlyStart();

        const projectCount = await this.prisma.project.count({
            where: { userId, createdAt: { gte: monthlyStart } },
        });

        return projectCount < planLimits.maxProjects;
    }

    /**
     * Consome minutos de processamento de projeto
     */
    async consumeProjectMinutes(
        userId: string,
        minutes: number,
    ): Promise<void> {
        await this.ensureAndReset(userId);
        await this.prisma.userQuota.update({
            where: { userId },
            data: { monthlyProjectMinutes: { increment: minutes } },
        });
    }

    /**
     * Consome uma render de clip
     */
    async consumeClipRender(userId: string): Promise<void> {
        await this.ensureAndReset(userId);
        await this.prisma.userQuota.update({
            where: { userId },
            data: { monthlyRenders: { increment: 1 } },
        });
    }

    /**
     * Retorna as quotas restantes para o usuário
     */
    async getRemainingQuota(userId: string): Promise<{
        remainingRenders: number;
        remainingMinutes: number;
        remainingProjects: number;
        plan: string;
        resetAt: Date;
    }> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);
        const monthlyStart = this.monthlyStart();

        const projectsThisMonth = await this.prisma.project.count({
            where: { userId, createdAt: { gte: monthlyStart } },
        });

        return {
            remainingRenders: Math.max(
                0,
                planLimits.maxRenders - quota.monthlyRenders,
            ),
            remainingMinutes: Math.max(
                0,
                planLimits.maxMinutes - quota.monthlyProjectMinutes,
            ),
            remainingProjects: Math.max(
                0,
                planLimits.maxProjects - projectsThisMonth,
            ),
            plan: quota.plan,
            resetAt: quota.monthlyResetAt,
        };
    }

    /**
     * Reseta as quotas mensais se necessário (deve ser chamado por cron job)
     */
    async resetMonthlyQuotaIfNeeded(userId: string): Promise<boolean> {
        const monthlyStart = this.monthlyStart();
        const quota = await this.ensureAndReset(userId);

        if (quota.monthlyResetAt < monthlyStart) {
            await this.prisma.userQuota.update({
                where: { userId },
                data: {
                    monthlyProjectMinutes: 0,
                    monthlyRenders: 0,
                    monthlyResetAt: monthlyStart,
                },
            });
            return true;
        }

        return false;
    }

    /**
     * Validates that the user can CREATE a new project (checks project count only).
     * Does NOT check minutes — that is done separately when processing starts.
     */
    async ensureCanCreateProject(userId: string): Promise<void> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);
        const monthlyStart = this.monthlyStart();

        const projectCount = await this.prisma.project.count({
            where: { userId, createdAt: { gte: monthlyStart } },
        });

        if (projectCount >= planLimits.maxProjects) {
            throw new ForbiddenException(
                `Você atingiu o limite de ${planLimits.maxProjects} projetos/mês no plano ${quota.plan}.`,
            );
        }
    }

    /**
     * Validates that the user can START PROCESSING (checks minutes only).
     * Used by attachUpload, attachYoutubeUrl and retry.
     * Does NOT re-check project count to avoid double-counting the current project.
     */
    async ensureCanStartProcessing(userId: string): Promise<void> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);

        if (quota.monthlyProjectMinutes >= planLimits.maxMinutes) {
            throw new ForbiddenException(
                `Você atingiu o limite de ${planLimits.maxMinutes} minutos processados/mês no plano ${quota.plan}.`,
            );
        }
    }

    /**
     * Validates that the user has enough minutes remaining to process a video of the given duration.
     * Called by the worker once the video duration is known.
     */
    async ensureCanProcessDuration(userId: string, durationSeconds: number): Promise<void> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);
        const durationMinutes = Math.ceil(durationSeconds / 60);

        if (quota.monthlyProjectMinutes + durationMinutes > planLimits.maxMinutes) {
            throw new ForbiddenException(
                `A duração do vídeo excede o saldo disponível de ${planLimits.maxMinutes - quota.monthlyProjectMinutes} minutos no plano ${quota.plan}.`
            );
        }
    }

    /**
     * Validates that the user has enough render quota to render a batch of clips.
     * Called by the worker before starting a render queue.
     */
    async ensureCanRenderBatch(userId: string, renderCount: number): Promise<void> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);

        if (quota.monthlyRenders + renderCount > planLimits.maxRenders) {
            throw new ForbiddenException(
                `Você possui saldo para renderizar ${planLimits.maxRenders - quota.monthlyRenders} clips, mas solicitou ${renderCount} no plano ${quota.plan}.`
            );
        }
    }

    /**
     * Validates both project count and minutes (legacy / used for compatibility).
     * Prefer ensureCanCreateProject or ensureCanStartProcessing for new code.
     */
    async ensureCanProcessProject(userId: string): Promise<void> {
        await this.ensureCanCreateProject(userId);
        await this.ensureCanStartProcessing(userId);
    }

    /**
     * Validação completa com mensagens antes de fazer render
     */
    async ensureCanRender(userId: string): Promise<void> {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);

        if (quota.monthlyRenders >= planLimits.maxRenders) {
            throw new ForbiddenException(
                `Você atingiu o limite de ${planLimits.maxRenders} renders/mês no plano ${quota.plan}.`,
            );
        }
    }

    /**
     * Registra minutos usados (compatível com código existente)
     */
    async registerMinutesUsed(userId: string, minutes: number): Promise<void> {
        await this.consumeProjectMinutes(userId, minutes);
    }

    /**
     * Registra um render (compatível com código existente)
     */
    async registerRender(userId: string): Promise<void> {
        await this.consumeClipRender(userId);
    }

    /**
     * Retorna informações de quota formatadas (compatível com código existente)
     */
    async getQuota(userId: string) {
        const quota = await this.ensureAndReset(userId);
        const planLimits = getPlanLimits(quota.plan);
        const monthlyStart = this.monthlyStart();

        const projectsThisMonth = await this.prisma.project.count({
            where: { userId, createdAt: { gte: monthlyStart } },
        });

        return {
            plan: quota.plan,
            projectsUsed: projectsThisMonth,
            projectsLimit: planLimits.maxProjects,
            minutesUsed: quota.monthlyProjectMinutes,
            minutesLimit: planLimits.maxMinutes,
            rendersUsed: quota.monthlyRenders,
            rendersLimit: planLimits.maxRenders,
            resetAt: quota.monthlyResetAt,
        };
    }

    private async ensureAndReset(userId: string) {
        const monthlyStart = this.monthlyStart();
        const existing = await this.prisma.userQuota.findUnique({
            where: { userId },
        });

        if (!existing) {
            return this.prisma.userQuota.create({
                data: {
                    userId,
                    plan: "free",
                    monthlyResetAt: monthlyStart,
                    maxProjectMinutesPerMonth: 60,
                    maxRendersPerMonth: 20,
                    maxProjectsPerMonth: 5,
                },
            });
        }

        if (existing.monthlyResetAt < monthlyStart) {
            return this.prisma.userQuota.update({
                where: { userId },
                data: {
                    monthlyProjectMinutes: 0,
                    monthlyRenders: 0,
                    monthlyResetAt: monthlyStart,
                },
            });
        }

        return existing;
    }
}
