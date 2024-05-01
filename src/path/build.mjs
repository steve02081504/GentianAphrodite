import CardFileInfo from "../cardinfo.mjs";

CardFileInfo.readDataFiles();
CardFileInfo.Build(process.argv[2], process.argv[3]);
