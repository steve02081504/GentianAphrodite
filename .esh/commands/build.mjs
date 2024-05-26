import CardFileInfo from "../../src/cardinfo.mjs";

CardFileInfo.readDataFiles();
if ((process.argv[2] ??= 'default') == 'default')
	console.log(`building card to ${process.argv[3] || `./build/${process.argv[2]}.png`}`);
else
	console.log(`building subVer: ${process.argv[2]}${process.argv[3] ? ' to '+process.argv[3] : ''}`);
CardFileInfo.Build(process.argv[2], process.argv[3], process.argv[4]);
