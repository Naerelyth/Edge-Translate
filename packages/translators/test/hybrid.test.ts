import axios from "axios";
import HybridTranslator from "../src/translators/hybrid";

describe("hybrid translator api", () => {
    const TRANSLATOR = new HybridTranslator(
        {
            translators: ["GoogleTranslate"],
            selections: {
                originalText: "GoogleTranslate",
                mainMeaning: "GoogleTranslate",
                tPronunciation: "GoogleTranslate",
                sPronunciation: "GoogleTranslate",
                detailedMeanings: "GoogleTranslate",
                definitions: "GoogleTranslate",
                examples: "GoogleTranslate",
            },
        },
        {}
    );

    beforeAll(() => {
        // Service Worker 호환 axios가 이미 설정됨 - adapter 설정 불필요
    });

    it("to detect language of English text", (done) => {
        TRANSLATOR.detect("hello")
            .then((result) => {
                expect(result).toEqual("en");
                done();
            })
            .catch((error) => {
                done(error);
            });
    });

    it("to detect language of Chinese text", (done) => {
        TRANSLATOR.detect("你好")
            .then((result) => {
                expect(result).toEqual("zh-CN");
                done();
            })
            .catch((error) => {
                done(error);
            });
    });

    it("to translate a piece of English text", (done) => {
        TRANSLATOR.translate("hello", "en", "zh-CN")
            .then((result) => {
                expect(result.mainMeaning).toEqual("你好");
                expect(result.originalText).toEqual("hello");
                done();
            })
            .catch((error) => {
                done(error);
            });
    });

    it("to translate a piece of Chinese text", (done) => {
        TRANSLATOR.translate("你好", "zh-CN", "en")
            .then((result) => {
                expect(result.mainMeaning).toEqual("Hello");
                expect(result.originalText).toEqual("你好");
                done();
            })
            .catch((error) => {
                done(error);
            });
    });
});
