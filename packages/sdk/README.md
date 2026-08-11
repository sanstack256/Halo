
# @halo-trace/sdk

Halo is a developer observability and investigation platform for capturing production errors, application events, HTTP activity, performance data, sessions, breadcrumbs, and contextual metadata.

The SDK sends telemetry to your Halo instance, where it can be correlated and investigated alongside other production evidence.

## Installation

### npm

```bash
npm install @halo-trace/sdk
````

### pnpm

```bash
pnpm add @halo-trace/sdk
```

## Quick Start

```ts
import { Halo } from "@halo-trace/sdk";

const halo = new Halo({
    apiKey: "your-api-key",
    endpoint: "https://your-halo-instance.com/api",
    environment: "production",
    release: "1.0.0",
});
```

Automatic capture is enabled by default.

## Configuration

```ts
const halo = new Halo({
    apiKey: "your-api-key",
    endpoint: "https://your-halo-instance.com/api",
    environment: "production",
    release: "1.0.0",
    autoCapture: true,
    enabled: true,
});
```

### Options

| Option        | Type      | Description                                                                   |
| ------------- | --------- | ----------------------------------------------------------------------------- |
| `apiKey`      | `string`  | API key used to authenticate telemetry requests.                              |
| `endpoint`    | `string`  | Halo API endpoint.                                                            |
| `environment` | `string`  | Runtime environment such as `production` or `staging`.                        |
| `release`     | `string`  | Application release or version identifier.                                    |
| `autoCapture` | `boolean` | Enables automatic runtime error and HTTP instrumentation. Defaults to `true`. |
| `enabled`     | `boolean` | Enables or disables telemetry collection. Defaults to `true`.                 |
| `sessionId`   | `string`  | Optional existing session identifier.                                         |

## Capturing Exceptions

Capture an exception explicitly:

```ts
try {
    await processCheckout();
} catch (error) {
    await halo.captureException(error);
}
```

Halo preserves the error message and stack trace when available.

## Capturing Messages

Capture an informational event:

```ts
await halo.captureMessage(
    "Checkout completed",
);
```

## Performance

Capture performance information explicitly:

```ts
await halo.capturePerformance({
    title: "Checkout request",
    durationMs: 420,
    operation: "POST",
    resource: "/api/checkout",
    status: 200,
});
```

Additional metadata can be attached:

```ts
await halo.capturePerformance({
    title: "Database query",
    durationMs: 1250,
    operation: "database.query",
    resource: "postgres-primary",
    status: 200,
    metadata: {
        queryType: "SELECT",
        table: "orders",
    },
});
```

## Automatic HTTP Instrumentation

When automatic capture is enabled, Halo instruments `fetch()` requests.

For example:

```ts
await fetch(
    "https://api.example.com/checkout",
);
```

Halo records HTTP information including:

* HTTP method
* Request resource
* Response status
* Request duration
* Request and trace identifiers
* Network errors

Halo's own ingestion requests are automatically excluded from HTTP instrumentation to prevent telemetry loops.

## Sessions

Start a session:

```ts
const sessionId =
    halo.startSession();
```

Retrieve the current session:

```ts
const sessionId =
    halo.getSessionId();
```

End a session:

```ts
halo.endSession();
```

## Users

Associate telemetry with a user:

```ts
halo.setUser({
    id: "user_123",
});
```

Clear the current user:

```ts
halo.clearUser();
```

User information is automatically attached to subsequently captured events.

## Tags

Add persistent tags:

```ts
halo.setTag(
    "plan",
    "pro",
);

halo.setTag(
    "region",
    "ap-south-1",
);
```

Remove a tag:

```ts
halo.removeTag("plan");
```

Tags are attached to subsequently captured events.

## Breadcrumbs

Breadcrumbs provide context leading up to an event:

```ts
halo.addBreadcrumb({
    category: "checkout",
    message: "Checkout button clicked",
});
```

Structured data can also be attached:

```ts
halo.addBreadcrumb({
    category: "database",
    message: "Started database query",
    data: {
        resource: "postgres-primary",
        operation: "checkout.create",
    },
});
```

Clear breadcrumbs when necessary:

```ts
halo.clearBreadcrumbs();
```

## Manual Event Capture

Halo also supports structured event capture:

```ts
await halo.capture({
    type: "ERROR",
    title: "Database connection failed",
    message:
        "Checkout service could not connect to the database.",
    severity: "ERROR",
    service: "checkout-api",
    resource: "postgres-primary",
    operation: "checkout.create",
    status: 504,
    metadata: {
        database: "postgres",
    },
});
```

Supported event types include:

* `ERROR`
* `MESSAGE`
* `TRACE`

## Flushing Events

Halo queues events before sending them.

Flush pending events explicitly when needed:

```ts
await halo.flush();
```

This can be useful before an application or process exits.

## Automatic Capture

Automatic capture is enabled by default:

```ts
const halo = new Halo({
    apiKey: "your-api-key",
});
```

Disable automatic capture:

```ts
const halo = new Halo({
    apiKey: "your-api-key",
    autoCapture: false,
});
```

With automatic capture disabled, you can still capture events manually.

## Disabling the SDK

Disable telemetry completely:

```ts
const halo = new Halo({
    apiKey: "your-api-key",
    enabled: false,
});
```

## Environment and Release Tracking

Set environment and release information when initializing Halo:

```ts
const halo = new Halo({
    apiKey: "your-api-key",
    environment: "production",
    release: "2026.08.0",
});
```

This allows Halo to associate telemetry with the application environment and release that produced it.

## TypeScript

The package includes TypeScript declarations automatically.

```ts
import type {
    HaloOptions,
    HaloUser,
    HaloBreadcrumb,
    HaloCaptureOptions,
} from "@halo-trace/sdk";
```

## API

The primary SDK class is:

```ts
import { Halo } from "@halo-trace/sdk";
```

Available methods include:

```ts
halo.startSession();
halo.endSession();
halo.getSessionId();

halo.setUser(user);
halo.clearUser();

halo.setTag(key, value);
halo.removeTag(key);

halo.addBreadcrumb(breadcrumb);
halo.clearBreadcrumbs();

halo.capture(event);
halo.captureException(error);
halo.captureMessage(message);
halo.capturePerformance(options);

halo.flush();
```

## Security

Do not expose privileged Halo credentials in client-side applications.

Avoid placing secrets, passwords, authentication tokens, or other sensitive information inside event metadata, tags, breadcrumbs, or user fields.

## Requirements

* Node.js 18 or newer
* A Halo API endpoint
* A valid Halo API key

## License

MIT

