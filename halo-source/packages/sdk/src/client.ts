export class HaloClient {
    constructor(
        private endpoint: string,
        private apiKey: string
    ) {}

    async post(path: string, body: unknown) {
        const response = await fetch(
            `${this.endpoint}${path}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Halo request failed (${response.status})`
            );
        }

        return response.json();
    }
}