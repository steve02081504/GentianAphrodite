$MY_DIR = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$FOUNT_DIR = Split-Path $(Split-Path (Get-Command fount.ps1).Path -Parent) -Parent
$CI_DIR = try {
	Split-Path $(Split-Path (Get-Command fount-charCI.ps1).Path -Parent) -Parent -ErrorAction Stop
}
catch {
	"$FOUNT_DIR/../fount-charCI/"
}
if ($env:EdenOS) { $is_EdenOS = 1; $env:EdenOS = '' } # 避免spam
& $CI_DIR/path/fount-charCI.ps1 $MY_DIR
if ($is_EdenOS) { $env:EdenOS = 1 }
