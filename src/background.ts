import { CACHE_ACTIONS, DefinitionEntry } from "./types";
import { getDefinition } from "./api_client/client";
import PouchDB from "pouchdb";
import { API_ACTIONS } from "./api_client/constants";

let db: PouchDB.Database = new PouchDB("CantoTranslate");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ appState: true });
});

chrome.runtime.onMessage.addListener(
  (message: any, _: chrome.runtime.MessageSender, sendResponse: any) => {
    if (message.action === API_ACTIONS.GET_DEFINITION) {
      getDefinition(message.text).then((definitionEntry: DefinitionEntry) => {
        if (definitionEntry['traditional'] === undefined) {
          // If the definition cannot be found, just send the selected text
          sendResponse({"traditional": message.text});
        } else if (definitionEntry['message'] !== undefined) {
          console.debug("Received exceptional message: " + definitionEntry['message']);
          sendResponse({"traditional": message.text});
        } else {
          sendResponse(definitionEntry);
        }
      });

      // Return true allows us to keep the communication channel open
      // so we can sendResponse back
      return true;
    }

    if (message.action === CACHE_ACTIONS.SET_CACHE) {
      let entry: DefinitionEntry = message.data;
      // PouchDB requires the primary key to be _id
      entry["_id"] = entry["traditional"];

      db.put(entry).catch((err) => {
        sendResponse(err);
      });

      return true;
    }

    if (message.action === CACHE_ACTIONS.GET_CACHE) {
      db.get(message.text)
        .then((definitionEntry) => {
          sendResponse(definitionEntry);
        })
        .catch((err) => {
          sendResponse(err);
        });

      return true;
    }
  }
);
