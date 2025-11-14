import axios from "axios";
import GoogleTranslator from "../src/translators/google";

describe("google translator api", () => {
    const TRANSLATOR = new GoogleTranslator();

    beforeAll(() => {
        // Service Worker 호환 axios가 이미 설정됨 - adapter 설정 불필요
    });

    it("to update TKK", (done) => {
        TRANSLATOR.updateTKK()
            .then(() => {
                expect(typeof TRANSLATOR.TKK[0]).toEqual("number");
                expect(typeof TRANSLATOR.TKK[1]).toEqual("number");
                done();
            })
            .catch((error) => {
                done(error);
            });
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
