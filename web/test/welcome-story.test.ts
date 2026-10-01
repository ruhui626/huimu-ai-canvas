import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chapters, getWelcomeLook, welcomeLooks } from "../src/pages/welcome/story";

const publicFile = (url: string) => resolve(import.meta.dir, "../public", url.replace(/^\//, ""));

describe("welcome story", () => {
    test("uses Huimu and only the three approved looks", () => {
        expect(chapters[0].title).toBe("绘幕");
        expect(welcomeLooks.map((look) => look.id)).toEqual(["spring", "charge", "wing-it"]);
        expect(getWelcomeLook("").id).toBe("spring");
        expect(getWelcomeLook("?look=unknown").id).toBe("spring");
        for (const look of welcomeLooks) expect(getWelcomeLook(`?look=${look.id}`)).toBe(look);
    });

    test("every reel slot has local media and screenplay", () => {
        for (const look of welcomeLooks) {
            expect(look.frames).toHaveLength(12);
            expect(look.screenplay).toHaveLength(12);
            expect(look.screenplay.every((line) => line.trim().length > 0)).toBe(true);
            for (const frame of look.frames) expect(existsSync(publicFile(frame))).toBe(true);
            if (look.video) expect(existsSync(publicFile(look.video))).toBe(true);
        }
        expect(welcomeLooks.filter((look) => look.video).map((look) => look.id)).toEqual(["charge"]);
    });

    test("welcome page omits workbench, contributors, and GitHub entry points", async () => {
        const source = await Bun.file(new URL("../src/pages/welcome/index.tsx", import.meta.url)).text();

        expect(source).not.toContain('href="#workbench"');
        expect(source).not.toContain('href="#contributors"');
        expect(source).not.toContain("WelcomeContributorsCard");
        expect(source).not.toContain("ddcat-ai/open-ai-canvas");
        expect(source).not.toContain("workbench-preview");
        expect(source).toContain('href="#welcome-ending"');
        expect(source).toContain('id="welcome-ending"');
        expect(source).toContain('document.getElementById("welcome-ending")?.scrollIntoView');
    });

    test("credits cover all looks separately from the code license", () => {
        const credits = readFileSync(publicFile("/welcome/credits.html"), "utf8");
        expect(credits).toContain("https://creativecommons.org/licenses/by/4.0/");
        for (const look of welcomeLooks) expect(credits).toContain(`id="${look.id}"`);
        expect(credits).not.toContain("竹影");
        expect(existsSync(publicFile("/welcome/sequence.mp4"))).toBe(false);
    });
});
