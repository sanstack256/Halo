import { chromium } from "playwright";

async function main() {
    console.log("Launching Chrome...");
    const browser = await chromium.launch({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: true,
    });
    const context = await browser.newContext();
    await context.addCookies([
        {
            name: "halo-dev-auth",
            value: "true",
            domain: "localhost",
            path: "/",
        },
    ]);
    const page = await context.newPage();
    console.log("Navigating to http://localhost:3000/explore...");
    await page.goto("http://localhost:3000/explore", { waitUntil: "networkidle" });
    const title = await page.title();
    console.log("Page title:", title);
    const content = await page.content();
    console.log("HTML length:", content.length);
    console.log("Contains 'Search'?", content.includes("Search"));
    await browser.close();
    console.log("Browser closed successfully.");
}

main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
});
