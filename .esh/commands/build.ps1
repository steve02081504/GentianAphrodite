[CmdletBinding()]
param (
	$SubVerId = 'default',
	$OutPath = $null
)
npm run build $SubVerId $OutPath
