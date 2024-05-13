Format-FileSize (ls -R | ?{"$_".EndsWith('.yaml')} | %{$_.Length} | Measure-Object -Sum).Sum
