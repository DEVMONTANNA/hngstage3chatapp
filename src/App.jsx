import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [capabilities, setCapabilities] = useState(null);
  const [language, setLanguage] = useState("");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [detector, setDetector] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [translateTo, setTranslateTo] = useState("");
  const [translatedMsg, setTranslatedMsg] = useState("");
  const [translator, setTranslator] = useState(null);

  useEffect(() => {
    const setupLanguageDetector = async () => {
      if (!("ai" in self) || !("languageDetector" in self.ai)) {
        console.error("❌ Language Detector API is not available.");
        return;
      }

      try {
        const capabilities = await self.ai.languageDetector.capabilities();
        setCapabilities(capabilities);

        let detectorInstance;
        if (capabilities.available === "readily") {
          detectorInstance = await self.ai.languageDetector.create();
        } else if (capabilities.available === "after-download") {
          setIsDownloading(true);
          detectorInstance = await self.ai.languageDetector.create({
            monitor(m) {
              m.addEventListener("downloadprogress", (e) => {
                setDownloadProgress(Math.round((e.loaded / e.total) * 100));
              });
            },
          });
          await detectorInstance.ready;
          setIsDownloading(false);
        }

        setDetector(detectorInstance);
      } catch (error) {
        console.error("❌ Error initializing language detector:", error);
      }
    };

    const setupTranslator = async () => {
      if (!("ai" in self) || !("translator" in self.ai)) {
        console.error("❌ Translator API is not available.");
        return;
      }

      try {
        const capabilities = await self.ai.translator.capabilities();
        if (capabilities.languagePairAvailable("en", "fr") !== "no") {
          const translatorInstance = await self.ai.translator.create({
            sourceLanguage: "en",
            targetLanguage: "fr",
            monitor(m) {
              m.addEventListener("downloadprogress", (e) => {
                console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
              });
            },
          });
          setTranslator(translatorInstance);
        } else {
          console.error("❌ Language pair is not supported.");
        }
      } catch (error) {
        console.error("❌ Error initializing translator:", error);
      }
    };

    setupLanguageDetector();
    setupTranslator();
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    setMessages([...messages, inputText]);
    detectLanguage(inputText);
    setInputText("");
  };

  const detectLanguage = async (text) => {
    if (!detector) {
      console.error("❌ Detector is not initialized.");
      return;
    }
    try {
      const results = await detector.detect(text);
      if (results.length > 0) {
        setLanguage(results[0].detectedLanguage);
      }
    } catch (error) {
      console.error("❌ Error detecting language:", error);
    }
  };

  const handleTranslate = async (msg, targetLanguage) => {
    if (!translator) {
      console.error("❌ Translator is not initialized.");
      setTranslatedMsg("Translation failed ❌");
      return;
    }

    try {
      const translatedText = await translator.translate(msg);
      setTranslatedMsg(translatedText || "Translation failed ❌");
    } catch (error) {
      console.error("❌ Error translating message:", error);
      setTranslatedMsg("Translation failed ❌");
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-100 p-4 justify-center items-center">
      {isDownloading && <p>⏳ Downloading model... {downloadProgress}%</p>}
      <div className="flex-1 w-full max-w-3xl overflow-y-auto p-4 border rounded chatScreen transition-transform duration-300 hover:scale-102">
        {messages.map((msg, index) => (
          <div key={index} className="relative">
            <div className="p-2 my-2 bg-blue-500 w-[80%] md:w-[60%] break-words text-white rounded-[20px] font-[verdana] relative">
              <div className="mt-[8px]">
                <div className="flex justify-between">
                  {msg.length > 150 && (
                    <button className="p-[5px] rounded-4xl bg-white text-[black] text-[12px]">
                      summarize
                    </button>
                  )}
                  <select
                    className="p-[5px] bg-[#fff] text-black rounded-[20px] font-[verdana] text-[12px]"
                    onChange={(e) => {
                      setTranslateTo(e.target.value);
                      handleTranslate(msg, e.target.value);
                    }}
                  >
                    <option value="">Translate</option>
                    <option value="pt">Portuguese (Pt)</option>
                    <option value="es">Spanish (Es)</option>
                    <option value="ru">Russian (Ru)</option>
                    <option value="en">English (En)</option>
                    <option value="tr">Turkish (Tr)</option>
                    <option value="fr">French (Fr)</option>
                  </select>
                </div>
                {translatedMsg || msg}
              </div>
              <div className="mt-2 text-yellow-300 text-sm">
                Language: {language}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center w-full max-w-3xl justify-center">
        <input
          className="w-[100%] p-5 border rounded focus:outline-none"
          placeholder="Type your text here..."
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <div className="p-2">
          <button
            type="submit"
            className="ml-2 p-5 bg-blue-600 text-white border rounded"
            onClick={handleSendMessage}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
