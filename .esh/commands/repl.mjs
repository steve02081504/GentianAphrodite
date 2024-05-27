import CardFileInfo from "../../src/cardinfo.mjs";
import repl from "repl";


CardFileInfo.readDataFiles();
repl.start({
	prompt: '> ',
	useGlobal: true,
}).context.CardInfo = CardFileInfo;
