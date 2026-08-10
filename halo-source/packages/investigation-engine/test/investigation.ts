import {
    investigate,
    type Evidence,
} from "../src";

const evidence: Evidence[] = [

    {
        id: "deployment-1",

        type: "DEPLOYMENT",

        timestamp: new Date(
            "2026-08-08T13:42:00"
        ),

        source: "vercel",

        service: "payment-api",

        title: "Deployment v1.2.0",

        description:
            "Production deployment",

        metadata: {},
    },

    {
        id: "error-1",

        type: "ERROR",

        timestamp: new Date(
            "2026-08-08T13:42:15"
        ),

        source: "sdk",

        service: "payment-api",

        title: "Payment timeout",

        description:
            "Stripe request timed out",

        metadata: {},
    },

    {
        id: "error-2",

        type: "ERROR",

        timestamp: new Date(
            "2026-08-08T13:42:18"
        ),

        source: "sdk",

        service: "payment-api",

        title: "Payment timeout",

        description:
            "Stripe request timed out",

        metadata: {},
    },

];

const investigation =
    investigate(evidence);

console.dir(
    investigation,
    {
        depth: null,
    }
);