import { CardFileInfo } from "../cardinfo.mjs";
import winfoFixer from "../winfo-fixer.mjs";

CardFileInfo.readDataFiles();
winfoFixer(CardFileInfo.character_book);
CardFileInfo.saveDataFiles();
