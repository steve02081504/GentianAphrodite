import CardFileInfo from "../cardinfo.mjs";

CardFileInfo.readDataFiles();
if ((process.argv[2] || 'default') == 'default')
	console.log(`building Card to ${process.argv[3] || `./build/${process.argv[2]}.png`}`);
else
	console.log(`building subVer: ${process.argv[2]} to ${process.argv[3] || `./build/${process.argv[2]}.png`}`);
CardFileInfo.Build(process.argv[2], process.argv[3]);
