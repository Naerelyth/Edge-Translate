import BingTranslator from "../src/translators/bing";

describe("bing translator api", () => {
    const TRANSLATOR = new BingTranslator();

    it("to update IG and IID", async () => {
        await TRANSLATOR.updateTokens();
        expect(typeof TRANSLATOR.IG).toEqual("string");
        expect(TRANSLATOR.IG.length).toBeGreaterThan(0);

        expect(typeof TRANSLATOR.IID).toEqual("string");
        expect(TRANSLATOR.IID!.length).toBeGreaterThan(0);
    }, 10000);

    it("should translate text from English to Korean", async () => {
        const result = await TRANSLATOR.translate("Hello world", "en", "ko");
        expect(result.mainMeaning).toBeTruthy();
    }, 15000);
});
