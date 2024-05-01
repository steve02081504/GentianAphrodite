import CardFileInfo from "../cardinfo.mjs";

CardFileInfo.readDataFiles();
console.log(`building subVer: ${process.argv[2]} to ${process.argv[3] || `./build/${process.argv[2]}.png`}`);
CardFileInfo.Build(process.argv[2], process.argv[3]);
