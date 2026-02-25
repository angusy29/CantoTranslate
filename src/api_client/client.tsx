import { DefinitionEntry } from "../types";
import { dryable } from "../utils/dryable";
import { API_ACTIONS } from "./constants";

const API_SERVER: string =
  "https://mb0vkk3lb0.execute-api.ap-southeast-2.amazonaws.com/Staging/";

const dryrunGetEntries: DefinitionEntry[] = [
  {
    _id: "蘋果",
    traditional: "蘋果",
    simplified: "苹果",
    pinyin: "ping2 guo3",
    jyutping: "ping4 gwo2",
    definitions: ["This is a dryrun"],
    message: "",
  },
];

export class CantoTranslateClient {
  @dryable(mock_get_entries, Promise.resolve(dryrunGetEntries))
  async getEntries(text: string): Promise<DefinitionEntry[]> {
    const response = await fetch(
      `${API_SERVER}${API_ACTIONS.GET_ENTRIES}?search=${encodeURIComponent(
        text
      )}`
    );

    const entries = await response.json();

    if (!entries || !entries.length) {
      return [];
    }

    return entries.map((entry: any) => ({
      _id: entry.traditional,
      traditional: entry.traditional,
      simplified: entry.simplified,
      pinyin: entry.pinyin,
      jyutping: entry.jyutping,
      definitions: entry.definitions || [],
      message: "",
    }));
  }
}