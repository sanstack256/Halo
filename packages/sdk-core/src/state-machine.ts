import type { SessionState } from "@halo-trace/sdk-types";

export class SessionStateMachine {
    private currentState: SessionState = "IDLE";
    private readonly listeners: Array<(state: SessionState, previous: SessionState) => void> = [];

    public getState(): SessionState {
        return this.currentState;
    }

    public canTransitionTo(next: SessionState): boolean {
        switch (this.currentState) {
            case "IDLE":
                return next === "INITIALIZING" || next === "RECORDING" || next === "STOPPED";
            case "INITIALIZING":
                return next === "RECORDING" || next === "STOPPED";
            case "RECORDING":
                return (
                    next === "ERROR_TRIGGERED" ||
                    next === "FLUSHING" ||
                    next === "STOPPED"
                );
            case "ERROR_TRIGGERED":
                return next === "POST_ERROR_RECORDING" || next === "FLUSHING" || next === "STOPPED";
            case "POST_ERROR_RECORDING":
                return next === "FLUSHING" || next === "STOPPED";
            case "FLUSHING":
                return next === "RECORDING" || next === "STOPPED" || next === "IDLE";
            case "STOPPED":
                // Can re-initialize if explicitly restarted
                return next === "INITIALIZING" || next === "RECORDING" || next === "IDLE";
            default:
                return false;
        }
    }

    public transition(next: SessionState): boolean {
        if (this.currentState === next) {
            return true; // Idempotent
        }

        if (!this.canTransitionTo(next)) {
            return false;
        }

        const prev = this.currentState;
        this.currentState = next;
        this.notify(next, prev);
        return true;
    }

    public onTransition(listener: (state: SessionState, previous: SessionState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx >= 0) this.listeners.splice(idx, 1);
        };
    }

    private notify(next: SessionState, prev: SessionState): void {
        for (const listener of this.listeners) {
            try {
                listener(next, prev);
            } catch {
                // Safeguard against subscriber failures
            }
        }
    }
}
