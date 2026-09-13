import { HaloReplay } from "./recorder";
import type { HaloReplayOptions } from "./types";

export { HaloReplay } from "./recorder";
export { ReplayRingBuffer } from "./ring-buffer";
export { HaloFeedbackWidget } from "./feedback-widget";
export { buildMaskerConfig, isUrlIgnored, sanitizeUrl } from "./masker";
export type {
    HaloReplayOptions,
    FeedbackModalOptions,
    ReplayPrivacyOptions,
    ReplayChunkPayload,
    ReplayNavigationPayload,
    ReplayRequestPayload,
    ReplayConsolePayload,
    ReplayErrorPayload,
    ReplayRageClickPayload,
    ReplayDeadClickPayload,
    ReplayLifecyclePayload,
    ReplayPrivacyState,
    HistoricalDomNode,
    HistoricalDomSnapshot,
} from "./types";

/**
 * Initializes and starts Halo Session Replay in the browser.
 */
export function initHaloReplay(options: HaloReplayOptions = {}): HaloReplay {
    const replay = new HaloReplay(options);
    replay.start();
    return replay;
}

