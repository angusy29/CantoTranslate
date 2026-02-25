import React, { useState } from "react";
import "../../public/styles/card.css";
import "../../public/styles/common.css";
import { CardHeading, DefinitionEntry } from "../types";

export const APP_WRAPPER_ID = "canto-translate-chrome-extension-wrapper";
export const TRANSLATE_POPUP_ID = "canto-translate-card";


const SOUND_ICON = chrome.runtime.getURL("icons8-sound.ico");
const DISABLED_SOUND_ICON = chrome.runtime.getURL("icons8-disabled.ico");

export const TraditionalHeading = (props: CardHeading) => {
  const [isSoundPlaying, setIsSoundPlaying] = useState<boolean>(false);

  const sayWord = async (): Promise<void> => {
    setIsSoundPlaying(true);

    try {
      const url =
        "https://mb0vkk3lb0.execute-api.ap-southeast-2.amazonaws.com/Staging/get-pronunciation" +
        `?traditional=${encodeURIComponent(props.traditional)}`;

      const audio = new Audio(url);
      await audio.play();
    } catch (err) {
      console.error("Failed to play pronunciation", err);
    } finally {
      setIsSoundPlaying(false);
    }
  };

  return (
    <>
      <div className="row heading">
        <div className="column">
          <div className="traditional">{props.traditional}</div>
        </div>
        {props.simplified && (
          <div className="simplified">[{props.simplified}]</div>
        )}
        <div className="column column-center">
          <div className="indent">
            {!isSoundPlaying && (
              <img
                id="canto-translate-sound-icon"
                onClick={() => sayWord()}
                src={SOUND_ICON}
                width="20"
                height="20"
              />
            )}
            {isSoundPlaying && (
              <img
                id="canto-translate-disabled-sound-icon"
                src={DISABLED_SOUND_ICON}
                width="20"
                height="20"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const TranslationPopup = (props: any) => {
  const entries: DefinitionEntry[] = props.entries || [];
  const first: DefinitionEntry | undefined = entries[0];

  const traditional = first?.traditional ?? props.originalText ?? "";
  const simplified = first?.simplified ?? "";
  const jyutping = first?.jyutping ?? "";
  const pinyin = first?.pinyin ?? "";

  const googleTranslateLink =
    "https://translate.google.com/?sl=yue&tl=en&text=" +
    traditional +
    "&op=translate&hl=en";

  return (
    <>
      {props.show && entries.length > 0 && (
        <div
          className={TRANSLATE_POPUP_ID}
          id={TRANSLATE_POPUP_ID}
          style={{
            position: props.style.position,
            left: props.style.left + "px",
            top: props.style.top + "px",
          }}
        >
          <div className="content">
            <div className="canto-translate">
              {entries.map((entry: DefinitionEntry, index: number) => (
                <div
                  key={entry._id || index}
                  style={{
                    paddingTop: "8px",
                    paddingBottom: "12px",
                    marginBottom: index < entries.length - 1 ? "14px" : "0",
                    borderBottom:
                      index < entries.length - 1
                        ? "1px solid #ddd"
                        : "none",
                  }}
                >
                  <TraditionalHeading
                    traditional={entry.traditional}
                    simplified={entry.simplified}
                  />
                  <div className="row pronunciation">
                    <div className="jyutping">{entry.jyutping}</div>
                    <div className="pinyin">[{entry.pinyin}]</div>
                  </div>
                  <div className="row">
                    <div className="definition-heading">Definitions:</div>
                  </div>
                  <ol>
                    {entry.definitions.map((def: string, defIndex: number) => (
                      <li key={defIndex} className="text">
                        {def}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              <div className="row">
                <a
                  className="muted-text"
                  href={googleTranslateLink}
                  target="_blank"
                >
                  Search for {traditional} on Google Translate!
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {props.show && entries.length === 0 && !props.searchComplete && (
        <div
          className={TRANSLATE_POPUP_ID}
          id={TRANSLATE_POPUP_ID}
          style={{
            position: props.style.position,
            left: props.style.left + "px",
            top: props.style.top + "px",
          }}
        >
          <div className="content">
            <div className="canto-translate">
              <TraditionalHeading traditional={traditional} />
              <div className="row">
                <div className="definition-heading">Fetching definitions...</div>
              </div>
              <div className="row">
                <a
                  className="muted-text"
                  href={googleTranslateLink}
                  target="_blank"
                >
                  Search for {traditional} on Google Translate!
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {props.show && entries.length === 0 && props.searchComplete && (
        <div
          className={TRANSLATE_POPUP_ID}
          id={TRANSLATE_POPUP_ID}
          style={{
            position: props.style.position,
            left: props.style.left + "px",
            top: props.style.top + "px",
          }}
        >
          <div className="content">
            <div className="canto-translate">
              <TraditionalHeading traditional={traditional} />
              <div className="row">
                <div className="definition-heading">No definitions found!</div>
              </div>
              <div className="row">
                <a
                  className="muted-text"
                  href={googleTranslateLink}
                  target="_blank"
                >
                  Search for {traditional} on Google Translate!
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
