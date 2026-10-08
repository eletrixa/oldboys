<#
.SYNOPSIS
  Jumper: GoOldboys — cd to the oldboys repo and print branch.
#>
function global:GoOldboys { _GoRepo -Label 'oldboys' -Candidates @('F:\code\oldboys','/home/asajj/code/oldboys') }
