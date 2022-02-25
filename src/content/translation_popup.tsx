import React, { useState } from "react";
import "../../public/styles/card.css";
import "../../public/styles/common.css";
import { CardHeading } from "../types";

export const APP_WRAPPER_ID = "canto-translate-chrome-extension-wrapper";
export const TRANSLATE_POPUP_ID = "canto-translate-card";

declare const WebSpeech: any;
const SOUND_ICON = chrome.runtime.getURL("icons8-sound.ico");
const DISABLED_SOUND_ICON = chrome.runtime.getURL("icons8-disabled.ico");

export const TraditionalHeading = (props: CardHeading) => {
  const [isSoundPlaying, setIsSoundPlaying] = useState<boolean>(false);

  const sayWord = (): void => {
    setIsSoundPlaying(true);
    WebSpeech.speak(props.traditional);
  };

  WebSpeech.onfinish = (): void => {
    setIsSoundPlaying(false);
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
  const googleTranslateLink = "https://translate.google.com/?sl=zh-CN&tl=en&text=" + props.traditional + "&op=translate&hl=en";
  let definitions: string[] = [];

  if (props && props.definition) {
    definitions = props.definition.split("/");
  }

  return (
    <>
      {props.show && props.definition && (
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
            {props.definition && (
              <>
                <div className="canto-translate">
                  <TraditionalHeading
                    traditional={props.traditional}
                    simplified={props.simplified}
                  />
                  <div className="row pronunciation">
                    <div className="jyutping">{props.jyutping}</div>
                    <div className="pinyin">[{props.pinyin}]</div>
                  </div>
                  <div className="row">
                    <div className="definition-heading">Definitions:</div>
                  </div>
                  <ol>
                    {definitions.map((definition: string, index: number) => (
                      <li key={index} className="text">{definition}</li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {props.show && !props.definition && !props.searchComplete && (
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
            <>
              <div className="canto-translate">
                <TraditionalHeading traditional={props.traditional}/>
                <div className="row">
                  <div className="definition-heading">
                    Fetching definitions...
                  </div>
                </div>
              </div>
            </>
          </div>
        </div>
      )}
      {props.show && !props.definition && props.searchComplete && (
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
          <>
            <div className="canto-translate">
              <TraditionalHeading traditional={props.traditional} />
              <div className="row">
                <div className="definition-heading">
                  No definitions found!
                </div>
              </div>
              <div className="row">
                <a className="muted-text" href={googleTranslateLink} target="_blank">
                  Search for {props.traditional} on Google Translate!
                </a>
              </div>
            </div>
          </>
        </div>
      </div>
      )}
    </>
  );
};
