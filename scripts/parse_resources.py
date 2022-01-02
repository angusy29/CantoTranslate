import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

BASE_RESOURCES_PATH = Path(__file__).resolve().parent.parent / "resources"
DEFINITIONS_PATH = Path(BASE_RESOURCES_PATH) / "raw" / "definitions"
READINGS_PATH = Path(BASE_RESOURCES_PATH) / "raw" / "readings"

CANTONESE_DICTIONARY = DEFINITIONS_PATH / "cccanto-webdist.txt"
MANDARIN_DICTIONARY = DEFINITIONS_PATH / "cedict_1_0_ts_utf-8_mdbg.txt"
CHINESE_READINGS = READINGS_PATH / "cccedict-canto-readings-150923.txt"

CANTONESE_DICTIONARY_REGEX = "([^ ]*) ([^ ]*) (\[.*\]) (\{.*\}) (/.*/)"
MANDARIN_DICTIONARY_REGEX = "([^ ]*) ([^ ]*) (\[.*\]) (/.*/)"
CHINESE_READINGS_REGEX = "([^ ]*) ([^ ]*) (\[.*\]) (\{.*\})"

JSON_OUTPUT_FILE = BASE_RESOURCES_PATH / "processed" / "data.json"

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@dataclass
class WordEntry:
  _id: str
  simplified: str
  pinyin: str
  jyutping: str
  definition: str

words = {}

with open(CANTONESE_DICTIONARY) as f:
  for line in f:
    if line.startswith("#"):
      continue

    # Some lines have comments at the end (with space before '#'), so we remove those
    line = line.rstrip("\n").split(" #")[0]
    search = re.search(CANTONESE_DICTIONARY_REGEX, line)

    traditional = search.group(1)
    simplified = search.group(2)

    # Remove first and last characters, as these are the brackets or forward slashes
    pinyin = search.group(3)[1:-1]
    jyutping = search.group(4)[1:-1]
    definition = search.group(5)[1:-1]

    words[traditional] = WordEntry(_id=traditional, simplified=simplified, pinyin=pinyin, jyutping=jyutping, definition=definition)

print(words)

with open(MANDARIN_DICTIONARY) as f:
  for line in f:
    if line.startswith("#"):
      continue

    line = line.rstrip("\n")
    search = re.search(MANDARIN_DICTIONARY_REGEX, line)

    traditional = search.group(1)
    simplified = search.group(2)

    # Remove first and last characters, as these are the brackets or forward slashes
    pinyin = search.group(3)[1:-1]
    definition = search.group(4)[1:-1]

    if traditional not in words:
      words[traditional] = WordEntry(_id=traditional, simplified=simplified, pinyin=pinyin, jyutping="", definition=definition)


words_not_found = 0
total_words = 0

with open(CHINESE_READINGS) as f:
  for line in f:
    if line.startswith("#"):
      continue

    line = line.rstrip("\n")
    search = re.search(CHINESE_READINGS_REGEX, line)

    traditional = search.group(1)
    simplified = search.group(2)
    pinyin = search.group(3)[1:-1]     # Remove first and last characters, as these are the brackets or forward slashes
    jyutping = search.group(4)[1:-1]

    try:
      if not words[traditional].pinyin:
        words[traditional].pinyin = pinyin

      if not words[traditional].jyutping:
        words[traditional].jyutping = jyutping
    except KeyError:
      logger.warning(f"Could not find {traditional} in dictionary")
      words_not_found += 1
    
    total_words += 1

logger.info(f"{words_not_found}/{total_words} words not found in the dictionary")

JSON_OUTPUT_FILE.parent.mkdir(exist_ok=True, parents=True)

data = [ entry.__dict__ for _, entry in words.items() ]
with open(BASE_RESOURCES_PATH / "processed" / "data.json", "w+", encoding="utf-8") as f:
  json.dump(data, f, ensure_ascii=False, indent=4)
