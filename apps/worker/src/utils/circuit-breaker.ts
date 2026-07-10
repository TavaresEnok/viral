type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
    failureThreshold?: number;
    recoveryMs?: number;
}

export class CircuitBreaker {
    private state: CircuitState = "CLOSED";
    private consecutiveFailures = 0;
    private openedAt = 0;
    private readonly failureThreshold: number;
    private readonly recoveryMs: number;

    constructor(
        readonly name: string,
        options: CircuitBreakerOptions = {},
    ) {
        this.failureThreshold = options.failureThreshold ?? 3;
        this.recoveryMs = options.recoveryMs ?? 60_000;
    }

    get isOpen(): boolean {
        if (this.state === "OPEN" && Date.now() - this.openedAt >= this.recoveryMs) {
            this.state = "HALF_OPEN";
        }
        return this.state === "OPEN";
    }

    async call<T>(fn: () => Promise<T>): Promise<T> {
        if (this.isOpen) {
            throw new Error(`Circuit '${this.name}' is OPEN — skipping call`);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess() {
        this.consecutiveFailures = 0;
        this.state = "CLOSED";
    }

    private onFailure() {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.failureThreshold) {
            this.state = "OPEN";
            this.openedAt = Date.now();
        }
    }
}
