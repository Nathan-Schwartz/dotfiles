" Warning if first line too long
match ErrorMsg /\%1l.\%>51v/

augroup LowerCaseFirstLineOfCommit
  autocmd!
  autocmd BufWritePre * %s/\s\+$//e | :normal ggVgu
augroup END
