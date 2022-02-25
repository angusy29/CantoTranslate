import { mock_get_definition } from "../configurations/featureFlagTypes";
import { DefinitionEntry } from "../types";
import { dryable } from "../utils/dryable";
import { API_ACTIONS } from "./constants";

const API_SERVER: string =
  "https://mb0vkk3lb0.execute-api.ap-southeast-2.amazonaws.com/Staging/";

const dryrunGetDefinition = {
  traditional: "蘋果",
  simplified: "苹果",
  pinyin: "ping2 guo3",
  jyutping: "ping4 gwo2",
  definition: "This is a dryrun"
};

export class CantoTranslateClient {
  @dryable(mock_get_definition, Promise.resolve(dryrunGetDefinition))
  async getDefinition(text: string): Promise<DefinitionEntry> {
    const response = await fetch(
      `${API_SERVER}${API_ACTIONS.GET_DEFINITION}?traditional=${text}`
    );
    const definition = response.json();
    return definition;
  };
}