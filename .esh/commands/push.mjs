import CardFileInfo from "../../src/cardinfo.mjs";
import winfoFixer from "../../src/winfo-fixer.mjs";

CardFileInfo.readDataFiles();
winfoFixer(CardFileInfo.character_book);
CardFileInfo.saveCardInfo();
