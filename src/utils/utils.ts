import { TRANSLATE_POPUP_ID } from "../content/translation_popup";

export function isTranslationPopupShowing() {
  return !!document.getElementById(TRANSLATE_POPUP_ID);
}