import {
  TranslationPopup,
  APP_WRAPPER_ID,
  TRANSLATE_POPUP_ID,
} from "./translation_popup";
import { CACHE_ACTIONS, CardHeading, DefinitionEntry } from "../types";
import React from "react";
import ReactDOM from "react-dom";
import { API_ACTIONS } from "../api_client/constants";
import { isTranslationPopupShowing } from "../utils/utils";

const SERVER = "https://zhiwei-tech.com/cgi-bin/ekho2.pl";
const VOICE = "iflytekXiaomei";
const SPEED_DELTA = -10;

// This is intentionally declared to stop typescript from warning
// WebSpeech is imported via manifest.json
declare const WebSpeech: any;

WebSpeech.ready(() => {
  WebSpeech.server = SERVER;
  WebSpeech.setVoice(VOICE);
  WebSpeech.setSpeedDelta(SPEED_DELTA);
});

const REGEX_CHINESE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

// Hack to add our extension wrapper in DOM
// so we have an element to attach our react component to
const div = document.createElement("div");
div.id = APP_WRAPPER_ID;
document.body.appendChild(div);

const displayTranslatePopup = (event: MouseEvent, data: any) => {
  const position = "absolute";
  const left: number = window.pageXOffset + event.clientX;
  -100;
  const top: number = window.pageYOffset + event.clientY + 15;

  ReactDOM.render(
    <>
      {data && data.definition && (
        <TranslationPopup
          traditional={data.traditional}
          simplified={data.simplified}
          pinyin={data.pinyin}
          jyutping={data.jyutping}
          definition={data.definition}
          style={{ left, top, position }}
          show={true}
        />
      )}
      {data && !data.definition && (
        <TranslationPopup
          traditional={data.traditional}
          searchComplete={data.searchComplete}
          show={true}
          style={{ left, top, position }}
        />
      )}
    </>,
    document.getElementById("canto-translate-chrome-extension-wrapper")
  );
};

/**
 * Given an event and text, it generates a popup with the translation
 * at the event location
 * 
 * @param e Mouse event which occurred
 * @param text Text to translate
 */
const generateTranslationContent = async (e: MouseEvent, text: string) => {
  // Put a max length on how much people can translate
  if (text.length > 10) return;

  if (text.match(REGEX_CHINESE)) {
    const cardHeading: CardHeading = { traditional: text };
    // Display popup whichs says loading...
    displayTranslatePopup(e, { ...cardHeading, searchComplete: false });

    // Displays popup with definitions
    const generatePopup = async () => {
      chrome.runtime.sendMessage(
        { action: CACHE_ACTIONS.GET_CACHE, text: text },
        (data: DefinitionEntry) => {
          if (data.traditional) {
            console.debug(`Hit cache with: ${data.traditional}`);
            displayTranslatePopup(e, { ...data, searchComplete: true });
            return;
          }

          chrome.runtime.sendMessage(
            { action: API_ACTIONS.GET_DEFINITION, text: text },
            (data: DefinitionEntry) => {
              displayTranslatePopup(e, { ...data, searchComplete: true });
              chrome.runtime.sendMessage({ action: CACHE_ACTIONS.SET_CACHE, data: data });
            }
          );
        }
      );
    };
    await generatePopup();
  }
}

// Dismiss the translate popup when we click outside
// We are using javascript hacks instead of manipulating via React
// Because I couldn't figure out how to dynamically show/hide
// the component while passing in different props each time we
// select a different word
document.addEventListener("mousedown", (e: MouseEvent) => {
  const translationPopup = document.getElementById(TRANSLATE_POPUP_ID);
  if (!translationPopup?.contains(e.target as Node)) {
    ReactDOM.render(
      <>
        <TranslationPopup show={false} />
      </>,
      document.getElementById("canto-translate-chrome-extension-wrapper")
    );
  }
});

// Translations for hovering on highlighted text
document.addEventListener('mousemove', async (e: MouseEvent) => {
  // If the left click is pressed down, down translate the word
  // because user may not have finished highlighting
  if (e.buttons == 1) {
    return;
  }

  const highlighted = window.getSelection()?.toString();
  if (!highlighted) return;
  
  // This is the rectangle coordinates of the highlighted text
  const textRectangle = window.getSelection()?.getRangeAt(0).getClientRects();
  if (!textRectangle) return;
  
  for (var i = 0 ; i < textRectangle.length ; i++) {
    if(e.clientX >= textRectangle[i].left && e.clientX <= textRectangle[i].right &&
      e.clientY >= textRectangle[i].top  && e.clientY <= textRectangle[i].bottom
      ) {
        if (!isTranslationPopupShowing()) {
          await generateTranslationContent(e, highlighted);
          break;
        }
    }
  }
});

document.addEventListener("dblclick", (e: MouseEvent) => {
  chrome.storage.local.get("appState", async (data) => {
    if (!data.appState) return;

    const selection = window.getSelection();
    if (!selection) return;

    await generateTranslationContent(e, selection.toString());
  });
});
