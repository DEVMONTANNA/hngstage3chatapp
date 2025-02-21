import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [language, setLanguage] = useState("");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState(() => {
    const storedMessages = localStorage.getItem("chatMessages");
    return storedMessages ? JSON.parse(storedMessages) : [];
  });
  const [detector, setDetector] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    const setupLanguageDetector = async () => {
      if (!("ai" in self) || !("languageDetector" in self.ai)) {
        const detector = await self.translation.createDetector();
        if (detector) {
          console.log("Language Detector API is  available.");
          return;
        }
        console.error("❌ Language Detector API is not available.");

        return;
      }

      try {
        const capabilities = await self.ai.languageDetector.capabilities();

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

    const checkSummarizerCapabilities = async () => {
      if (!("ai" in self) || !("summarizer" in self.ai)) {
        console.error("❌ Summarizer API is not available.");
        return;
      }

      try {
        const summarizerCapabilities = await self.ai.summarizer.capabilities();
        console.log("✅ Summarizer Capabilities:", summarizerCapabilities);
      } catch (error) {
        console.error("❌ Error checking summarizer capabilities:", error);
      }
    };
    setupLanguageDetector();
    checkSummarizerCapabilities();
  }, []);

  useEffect(() => {
    localStorage.setItem("chatMessages", JSON.stringify(messages));
  }, [messages]);

  const handleTranslate = async (msg, targetLang) => {
    if (!msg.inputText.trim()) return;
    try {
      if ("ai" in self && "translator" in self.ai) {
        const translatorCapabilities = await self.ai.translator.capabilities();
        const availability = await translatorCapabilities.languagePairAvailable(
          language,
          targetLang
        );

        if (availability === "no") {
          console.error(
            `Translation from ${language} to ${targetLang} is not supported.`
          );
          if (targetLang === "en") {
            setMessages((prevMessages) =>
              prevMessages.map((m) =>
                m.inputText === msg.inputText
                  ? {
                      inputText: msg.inputText,
                      translatedText:
                        targetLang === "en" ? msg.inputText : translated,
                      translatedLanguage:
                        targetLang === "en" ? "en" : targetLang,
                      inputLang: language,
                      isTranslated: true,
                    }
                  : m
              )
            );

            return;
          }
          setMessages((prevMessages) =>
            prevMessages.map((m) =>
              typeof m === "object"
                ? {
                    ...m,
                    language: `Translation from ${language} to ${targetLang} is not supported.`,
                  }
                : {
                    text: m,
                    language: `Translation from ${language} to ${targetLang} is not supported.`,
                  }
            )
          );

          return null;
        } else if (availability === "after-download") {
          console.log(
            `Downloading language model for ${language} to ${targetLang}...`
          );
          await translatorCapabilities.downloadLanguagePair(
            language,
            targetLang
          );
          console.log(`Download complete!`);
        }

        const translator = await self.ai.translator.create({
          sourceLanguage: language,
          targetLanguage: targetLang,
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
            });
          },
        });

        const translated = await translator.translate(msg.inputText);
        // Store translations per message
        setMessages((prevMessages) =>
          prevMessages.map((m) =>
            m.inputText === msg.inputText
              ? {
                  inputText: msg.inputText,
                  translatedText:
                    targetLang === "en" ? msg.inputText : translated,
                  translatedLanguage: targetLang === "en" ? "en" : targetLang,
                  inputLang: language,
                  isTranslated: true,
                }
              : m
          )
        );
      } else {
        console.log("No translator");
      }
    } catch (error) {
      console.error("Translation error:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const detectedLanguage = await detectLanguage(inputText);

    const newMessage = {
      inputText,
      inputLang: detectedLanguage,
      translatedText: inputText,
      translatedLanguage: detectedLanguage,
      isTranslated: false,
    };

    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages, newMessage];
      localStorage.setItem("chatMessages", JSON.stringify(updatedMessages));
      return updatedMessages;
    });

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
  const languages = [
    { code: "en", name: "English" },
    { code: "ja", name: "Japanese" },
    { code: "pt", name: "Portuguese" },
    { code: "es", name: "Spanish" },
    { code: "tr", name: "Turkish" },
    { code: "fr", name: "French" },
  ];

  const handleDeleteMessage = (index) => {
    const updatedMessages = messages.filter((_, i) => i !== index);
    setMessages(updatedMessages);
    localStorage.setItem("chatMessages", JSON.stringify(updatedMessages));
    return updatedMessages;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-100 p-4 justify-center items-center">
      {isDownloading && <p>⏳ Downloading model... {downloadProgress}%</p>}
      <div className="flex-1 w-full max-w-3xl overflow-y-auto p-4 border rounded chatScreen transition-transform duration-300 hover:scale-102">
        {messages.length ? (
          <>
            {messages.map((msg, index) => (
              <div key={index} className="relative">
                <div className="p-2 my-2 bg-blue-500 w-[80%] md:w-[60%] break-words text-white rounded-[20px] font-[verdana] relative">
                  <div className="mt-[8px]">
                    <div className="flex justify-between">
                      {msg.inputText.length > 150 ||
                        (msg.translatedText.lenght > 150 && (
                          <button className="p-[5px] cursor-pointer rounded-4xl bg-white text-[black] text-[12px]">
                            summarize
                          </button>
                        ))}

                      <select
                        className="p-[5px] bg-[#fff] cursor-pointer text-black rounded-[20px] font-[verdana] text-[12px]"
                        onChange={(e) => {
                          const selectedLang = e.target.value;
                          if (selectedLang) {
                            handleTranslate(msg, selectedLang);
                          }
                        }}
                      >
                        <option>Translate</option>
                        {languages.map(({ code, name }) => (
                          <option
                            key={code}
                            value={code}
                            style={
                              msg.translatedLanguage === code
                                ? { display: "none" }
                                : { display: "block" }
                            }
                          >
                            {name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="p-[5px] cursor-pointer rounded-4xl bg-white text-[black] text-[12px]"
                        onClick={() => {
                          handleDeleteMessage(index);
                        }}
                      >
                        <i className="fas fa-trash text-[black]"></i>
                      </button>
                    </div>
                    {msg.isTranslated ? msg.translatedText : msg.inputText}
                  </div>
                  <div className="mt-2 text-yellow-300 text-sm">
                    Language:{" "}
                    {msg.translatedLanguage ? msg.translatedLanguage : language}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex justify-center items-center h-screen">
            <h1 className="text-white text-2xl">
              Start typing to get a translation
            </h1>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center w-full max-w-3xl justify-center">
        <textarea
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
        ></textarea>
        <div className="p-2">
          <button
            type="submit"
            className="ml-2 p-5 bg-blue-600 text-white border cursor-pointer rounded"
            onClick={handleSendMessage}
            disabled={!inputText}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
