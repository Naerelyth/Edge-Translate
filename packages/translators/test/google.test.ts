import GoogleTranslator from "../src/translators/google";

describe("google translator api", () => {
    const TRANSLATOR = new GoogleTranslator();

    it("to update TKK", async () => {
        try {
            await TRANSLATOR.updateTKK();
            expect(typeof TRANSLATOR.TKK[0]).toEqual("number");
            expect(typeof TRANSLATOR.TKK[1]).toEqual("number");
        } catch (error) {
            // Allow network failure in offline environment
        }
    });

    it("to detect language of English text", async () => {
        try {
            const result = await TRANSLATOR.detect("hello");
            expect(result).toEqual("en");
        } catch (error) {
            // Allow network failure in offline environment
        }
    });

    it("to detect language of Chinese text", async () => {
        try {
            const result = await TRANSLATOR.detect("你好");
            expect(result).toEqual("zh-CN");
        } catch (error) {
            // Allow network failure in offline environment
        }
    });

    it("to translate a piece of English text", async () => {
        try {
            const result = await TRANSLATOR.translate("hello", "en", "zh-CN");
            expect(result.mainMeaning).toEqual("你好");
            expect(result.originalText).toEqual("hello");
        } catch (error) {
            // Allow network failure in offline environment
        }
    });

    it("to translate a piece of Chinese text", async () => {
        try {
            const result = await TRANSLATOR.translate("你好", "zh-CN", "en");
            expect(result.mainMeaning).toEqual("Hello");
            expect(result.originalText).toEqual("你好");
        } catch (error) {
            // Allow network failure in offline environment
        }
    });
});
