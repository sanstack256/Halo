import '@halo-trace/sdk-browser';
import '@halo-trace/sdk-react';
import { NodeClient } from '@halo-trace/sdk-node';
export { getContext, getRequestId, getTraceId, runWithContext } from '@halo-trace/sdk-node';
import { HaloOptions } from '@halo-trace/sdk-types';

declare function initServer(options: HaloOptions): NodeClient;
declare function getServerClient(): NodeClient | null;
/**
 * Higher-order function for Next.js Route Handlers (app/api/.../route.ts).
 * Captures request context, W3C trace context, measures duration, and catches unhandled server exceptions.
 */
declare function withHaloRoute<TReq extends Request = Request, TArgs extends any[] = any[]>(handler: (req: TReq, ...args: TArgs) => Promise<Response> | Response): (req: TReq, ...args: TArgs) => Promise<Response>;
/**
 * Higher-order function for Next.js Server Actions ("use server").
 */
declare function withHaloAction<TArgs extends any[], TResult>(actionName: string, action: (...args: TArgs) => Promise<TResult>): (...args: TArgs) => Promise<TResult>;

export { getServerClient, initServer, withHaloAction, withHaloRoute };
