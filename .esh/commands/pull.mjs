import CardFileInfo from "../../src/cardinfo.mjs"
import winfoFixer from "../../src/winfo-fixer.mjs"

CardFileInfo.readCardInfo()
winfoFixer(CardFileInfo.character_book)
CardFileInfo.saveCardInfo()
CardFileInfo.saveDataFiles()
