import { CardFileInfo } from "../cardinfo.mjs";

CardFileInfo.readDataFiles();
await CardFileInfo.Build('CI');
CardFileInfo.readCardInfo('./build/CI.png', false);
CardFileInfo.saveDataFiles();
