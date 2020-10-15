" vim: foldmethod=marker foldlevel=0

" Run Pathogen (vim package manager)
execute pathogen#infect()

" NOTE:
" - Set up folding based on markers in the file. `za` toggles folds
" - Generate helptags with `:Helptags` or `execute pathogen#helptags()`
" - These functions clobber "z 'z and 'Z on the reg, beware.

" ---------- TODOS ---------- {{{1
" Plugin I am considering:
" - https://github.com/sjl/gundo.vim.git
" - https://github.com/tpope/unimpaired.vim
" - https://github.com/skywind3000/asyncrun.vim
"
" Things to explore/learn/practice
" - vim regex magic levels
" - recursive macros
" - multi-file find&replace workflows
" - using the undo tree
" - utilizing marks
" - [] mapping pairs (unimpaired, gitgutter, native, etc)

" ---------- General ---------- {{{1
" Override Y to behave like C and D
map Y y$

" Go to file in new tab
nnoremap gf <C-w>gf

" Save undos after file closes
set undofile
" Number of undos to save
set undolevels=1000
" Number of lines to save for undo
set undoreload=10000

" Set dirs so we don't litter all over
set undodir=~/.vim/cache/undo
set backupdir=~/.vim/cache/backup
set dir=~/.vim/cache/swap

" Prompt to save instead of erroring
set confirm

" Open horizontal splits below existing windows
set splitbelow

" No sounds or bells
set visualbell
set belloff=all

" Wrap lines at words when possible
set linebreak

" Turn on line numbers
set number

" highlight matching [{()}]
set showmatch

" Show tabs even if its just one file
set showtabline=2


" Work with crontabs
augroup CrontabConfig
  autocmd!
  autocmd BufNewFile,BufRead crontab.* set nobackup | set nowritebackup
augroup END

" Use the clipboard as the default register
set clipboard^=unnamed

" Delay after typing stops before checking again (used by gitgutter).
" Can cause issues under 1000ms
set updatetime=50

" Remove escape delays (This breaks arrow keys in insert mode)
set noesckeys

" Autocorrect some typos when trying to quit
command! W w
command! Wq wq
command! Q q
command! WQ wq

" ---------- Colors ---------- {{{1
" This is included in vim-sensible but for some reason even though my vim
" install has syntax support, has("syntax") must be evaluating to false,
" causing the plugin to not enable syntax
if !exists("g:syntax_on")
  syntax enable
endif

" Setup a color theme
set background=dark
colorscheme solarized

command! ToggleBackground :call ToggleBackground()

" Red Git conflict highlighting
match ErrorMsg '^\(<\|=\|>\)\{7\}\([^=].\+\)\?$'

" Toggle iterm and vim between dark and light
function! ToggleBackground() abort
  if &background == "dark"
    set background=light
    normal :!echo -e "\033]50;SetProfile=Light\a"
  elseif &background == "light"
    set background=dark
    normal :!echo -e "\033]50;SetProfile=Dark\a"
  endif

  if !exists('g:loaded_lightline')
    return
  endif

  try
    if g:colors_name =~# 'solarized'
      runtime autoload/lightline/colorscheme/solarized.vim
      call lightline#init()
      call lightline#colorscheme()
      call lightline#update()
    endif
  catch
  endtry
endfunction

" ---------- Plugins ---------- {{{1
" Ack {{{2
" Use ag instead of ack
let g:ackprg = 'ag --vimgrep --smart-case'

" Highlight hits
let g:ackhighlight = 1

" Command and function that run Ack.vim from the root of the repo
command! -nargs=+ AgFn :call AgFromRoot(<f-args>)
function! AgFromRoot(...)
  let git_root = system('git rev-parse --show-toplevel 2> /dev/null')[:-2]
  " The ! prevents jumping to the first hit
  execute "Ack! " . join(a:000) . " " . git_root
endfunction

" I type Ag out of habit
abbrev Ag AgFn
abbrev AG AgFn
abbrev ag AgFn

command! OpenQFTabs :call OpenQuickFixInTabs()

function! OpenQuickFixInTabs() abort
  " Close qf list to prevent mark errors
  normal :cclose

  " Save our spot so we can come back
  let current_file = expand('%:p')
  normal mz

  " Building a hash ensures we get each buffer only once
  let buffer_numbers = {}
  for quickfix_item in getqflist()
    let bufnr = quickfix_item['bufnr']
    " Lines without files will appear as bufnr=0
    if bufnr > 0
      " Get absolute path for each buffer
      let buffer_numbers[bufnr] = trim(fnameescape(expand("#" . bufnr . ":p")). ' ')
    endif
  endfor

  execute "normal :silent!$tab drop " . join(values(buffer_numbers)) . "\<CR>"
  " for qf_file in values(buffer_numbers)
  "   " Ignore Errors. Escape filepath strings. Open existing buffer or append new tab.
  "   execute "normal :silent!$tab drop " . qf_file . "\<CR>"
  " endfor

  normal :redraw!

  " Jump back to original file.
  execute "normal :silent!tab drop " . current_file . "\<CR>"
  normal `z

  normal :copen
endfunction

" ---------- Ale ---------- {{{2
" Set up auto fixers
let g:ale_fixers = { 'typescript': ['eslint', 'prettier-eslint'], 'javascript': ['eslint', 'prettier-eslint'], 'json': ['prettier'], 'python': ['autopep8'], 'bash': ['shfmt'], 'sh': ['shfmt'] }
let g:ale_linters = { 'javascript': ['flow', 'eslint'], 'json': ['jsonlint'], 'python': ['pylint'] }
let g:ale_yaml_yamllint_options='-d "{extends: relaxed, rules: {line-length: disable}}"'

let g:ale_lint_delay = 50
let g:ale_completion_enabled = 1

let g:ale_sign_error = 'X' " could use emoji
let g:ale_sign_warning = '?' " could use emoji
let g:ale_statusline_format = ['X %d', '? %d', '']
" %linter% is the name of the linter that provided the message
" %s is the error or warning message
let g:ale_echo_msg_format = '%linter% says %s'

" :help ale-reasonml-ols
let g:ale_reason_ols_use_global = 1




" GitGutter has gutter enabled which makes this option unnecessary
" Keep sign column open all the time so changes are less jarring
" let g:ale_sign_column_always = 1

" ---------- CamelCaseMotion ----------{{{2
" Make w and e respect camel (and snake, ironically) case
map <silent> w <Plug>CamelCaseMotion_w
map <silent> b <Plug>CamelCaseMotion_b
map <silent> e <Plug>CamelCaseMotion_e
map <silent> ge <Plug>CamelCaseMotion_ge
sunmap w
sunmap b
sunmap e
sunmap ge

" ---------- CtrlP ---------- {{{2
" Use ag in CtrlP for listing files. Lightning fast and respects .gitignore
let g:ctrlp_user_command = 'ag %s -l --nocolor -g ""'

" Display hidden files
let g:ctrlp_show_hidden = 1

"
" ---------- Git Gutter ---------- {{{2
" Don't create any key mappings
let g:gitgutter_map_keys = 0

" Colors
highlight clear SignColumn
highlight GitGutterAdd ctermfg=2
highlight GitGutterChange ctermfg=3
highlight GitGutterDelete ctermfg=1
highlight GitGutterChangeDelete ctermfg=4

" Keep gutter open
if exists('&signcolumn')  " Vim 7.4.2201
  set signcolumn=yes
else
  let g:gitgutter_sign_column_always = 1
endif

" ---------- Javascript ---------- {{{2
" let g:javascript_plugin_jsdoc = 0
let g:javascript_plugin_flow = 1

" ---------- LightLine ---------- {{{2
" Don't show current mode since it is in status bar
set noshowmode

" Use defaults, but take out file percentage, and add a clock
let g:lightline = {
      \   'colorscheme': 'solarized',
      \   'active': {
      \     'left': [ [ 'mode', 'paste' ],
      \               [ 'gitbranch', 'readonly', 'filepath' ] ],
      \     'right': [ [],
      \                [ 'lineinfo' ],
      \                [ 'modified', 'fileencoding', 'filetype' ] ]
      \   },
      \   'component_function': {
      \     'filepath': 'PrintFilePath',
      \     'gitbranch': 'fugitive#head',
      \   },
      \ }

" Function used for printing relative file path
function! PrintFilePath() abort
  return fnamemodify(expand("%"), ":~:.")
endfunction

" ---------- NERDTree ---------- {{{2
" Automatically delete the buffer of the file you just deleted with NerdTree:
let NERDTreeAutoDeleteBuffer = 1

" Toggle visibility of hidden files using i and I
let NERDTreeShowHidden=1

" Don't open NERDTree by default
let g:nerdtree_tabs_open_on_gui_startup=0

" Don't show ^G before file names
let g:NERDTreeNodeDelimiter = "\u00a0"

" Close tree once file is selected
let NERDTreeQuitOnOpen = 1

" Toggle Nerd Tree with control + b
nnoremap <silent> <c-b> :NERDTreeVCS <BAR> NERDTreeClose <BAR> NERDTreeFind<CR>

" ---------- Comfortable Motion ---------- {{{2
" I think these are the default factors
let g:comfortable_motion_friction = 80.0
let g:comfortable_motion_air_drag = 2.0

let g:comfortable_motion_no_default_key_mappings = 1

nnoremap <silent> <c-d> :call comfortable_motion#flick(120)<CR>
nnoremap <silent> <c-u> :call comfortable_motion#flick(-120)<CR>

" ---------- Startify ---------- {{{2
let g:startify_session_dir = '~/.vim/cache/session'

" ---------- Leader: General ---------- {{{1
" Map space to leader
let mapleader = " "

" Make space leader behave the same as other keys would
nnoremap <Space> <nop>

" turn off search highlight
nnoremap <leader>n :noh<CR>

" Fix linting errors
nnoremap <leader>af :ALEFix<CR>

" Map keys to navigate between lines with errors and warnings.
nnoremap <leader>an :ALENextWrap<cr>
nnoremap <leader>ap :ALEPreviousWrap<cr>

" Apply last operation to a range of lines
vnoremap <leader>. : normal .<CR>

" Apply "o" macro operation to the selected lines
vnoremap <leader>o : normal @o<CR>

" Fix indentation for the whole file
map <leader>= gg=G''

" Reload vimrc
nnoremap <leader>rel :source ~/.vimrc<CR>

" Clear CtrlP Caches
nnoremap <leader>p :CtrlPClearAllCaches<CR>

" Go to import and open source file in new tab (if import is in a single line)
nnoremap <leader>gf gd$hhh<C-w>gfn<CR>

" Search for highlighted text
vnoremap <leader>/ "zy/<C-R>z<CR>

" ---------- Leader: Custom Functions ---------- {{{1
" Mappings that use custom functions
nnoremap <leader>bot :call UseBottomDiff()<CR>
nnoremap <leader>top :call UseTopDiff()<CR>
nnoremap <leader>req :call JsRequire()<CR>
nnoremap <leader>imp :call JsImport()<CR>
nnoremap <leader>log :call JsLog()<CR>
nnoremap <leader>js  :call JsStringify()<CR>

" Picks the bottom section of a git conflict
function! UseBottomDiff() abort
  normal kmzj0
  normal /<<<<
  normal d/====
  normal dd
  normal />>>>
  normal dd
  normal 'z
endfunction

" Picks the top section of a git conflict
function! UseTopDiff() abort
  normal kmzj0
  normal /<<<<
  normal dd
  normal /====
  normal d/>>>>
  normal dd
  normal 'z
endfunction

" Creates a variable and require statement, uses z registry
function! JsImport() abort
  normal "zciWimport z from 'z';==
endfunction

" Creates a variable and require statement, uses z registry
function! JsRequire() abort
  normal "zciWconst z = require('z');==
endfunction

" Creates a labelled console.log, uses z registry
function! JsLog() abort
  normal "zciWconsole.log('z', z);==
endfunction

" Json stringify Word using z registry
function! JsStringify() abort
  normal "zciwJSON.stringify(z, null, 2)==
endfunction


" Paste list of captures from the last search
function! g:PasteCaptureList()
  normal :let t=[] | %s//\zs/\=add(t,submatch(0))[1:0]/g | pu=t
endfunction
nnoremap <leader>pc :call PasteGetHitList()<CR>



" Copied from Abolish by Tim Pope because they were scoped to the script and I
" want access for visual mode mappings
function! g:Mixedcase(word)
  return substitute(g:Camelcase(a:word),'^.','\u&','')
endfunction

function! g:Camelcase(word)
  " let word = substitute(a:word, '-', '_', 'g')
  let word = g:Snakecase(a:word)
  if word !~# '_' && word =~# '\l'
    return substitute(word,'^.','\l&','')
  else
    return substitute(word,'\C\(_\)\=\(.\)','\=submatch(1)==""?tolower(submatch(2)) : toupper(submatch(2))','g')
  endif
endfunction

function! g:Snakecase(word)
  let word = substitute(a:word,'::','/','g')
  let word = substitute(word, '\s', '_', 'g')
  let word = substitute(word,'\(\u\+\)\(\u\l\)','\1_\2','g')
  let word = substitute(word,'\(\l\|\d\)\(\u\)','\1_\2','g')
  let word = substitute(word,'[.-]','_','g')
  let word = tolower(word)
  return word
endfunction

function! g:Uppercase(word)
  return toupper(g:Snakecase(a:word))
endfunction

function! g:Dashcase(word)
  return substitute(g:Snakecase(a:word),'_','-','g')
endfunction

function! g:Spacecase(word)
  return substitute(g:Snakecase(a:word),'_',' ','g')
endfunction

function! g:Dotcase(word)
  return substitute(g:Snakecase(a:word),'_','.','g')
endfunction

function! g:Titlecase(word)
  return substitute(g:Spacecase(a:word), '\(\<\w\)','\=toupper(submatch(1))','g')
endfunction

" asdf_asdf-asdf asdfAsdf.asdf
vnoremap <leader>cc "zd:execute 'normal a' . Camelcase('z')
vnoremap <leader>cm "zd:execute 'normal a' . Mixedcase('z')
vnoremap <leader>ct "zd:execute 'normal a' . Titlecase('z')
vnoremap <leader>c_ "zd:execute 'normal a' . Snakecase('z')
vnoremap <leader>cu "zd:execute 'normal a' . Uppercase('z')
vnoremap <leader>c- "zd:execute 'normal a' . Dashcase('z')
vnoremap <leader>c<leader> "zd:execute 'normal a' . Spacecase('z')
vnoremap <leader>c. "zd:execute 'normal a' . Dotcase('z')


" ---------- Movement & Searching ---------- {{{1
" I override b,w,e, and ge in plugins > CamelCaseMotion

" highlight matches
set hlsearch

" Case insensitive unless a capital character is included
set ignorecase
set smartcase

"Start scrolling when we're 10 lines away
set scrolloff=10
set sidescrolloff=10

" Don't skip visual lines (wrapped text)
nnoremap j gj
nnoremap k gk
xnoremap j gj
xnoremap k gk

" ---------- Folding ---------- {{{1
" enable folding
set foldenable

" open most folds by default
set foldlevelstart=10

" 10 nested fold max
set foldnestmax=10

" fold based on indent level
set foldmethod=marker

" Custom Folding Colors
augroup FoldColorGroup
  highlight Folded cterm=NONE term=bold ctermfg=white
augroup END

" Custom Fold Content
set foldtext=FoldText()

function! FoldText()
  let line = getline(v:foldstart)

  let nucolwidth = &fdc + &number * &numberwidth
  let windowwidth = winwidth(0) - nucolwidth - 3
  let foldedlinecount = v:foldend - v:foldstart
  let line = trim(substitute(substitute(substitute(substitute(line, '\d', '', 'g'), '-', '', 'g'), '{', '', 'g'), '"', '', 'g'))
  let line = strpart(line, 0, windowwidth - 2 -len(foldedlinecount))

  if windowwidth > 100
    let maxtitlelength = 50
    let titlepadding = maxtitlelength - len(line)
    let fillcharcount = windowwidth - maxtitlelength - len(foldedlinecount) - (v:foldlevel * 2)
    return repeat('  ', v:foldlevel - 1) . '▸ ' . line . repeat(' ', titlepadding - 3) . 'L# ' . foldedlinecount . repeat(' ', fillcharcount) . ' '
  else
    let fillcharcount = windowwidth - len(line) - len(foldedlinecount) - (v:foldlevel * 2)
    return repeat('  ', v:foldlevel - 1) . '▸ ' . line . repeat(' ',fillcharcount) . foldedlinecount . '  '
  endif
endfunction

" ---------- Wildmenu ---------- {{{1
" configure visual autocomplete for command menu
set wildignorecase
set completeopt+=longest
set wildmode=longest:full,full

" ---------- Cursor ---------- {{{1
" Enable mouse
set mouse=a

" Disable cursor blink
set guicursor=a:blinkon0

" ---------- Spaces and Tabs ---------- {{{1
" Remove trailing whitespace on save
augroup RemoveTrailingWhitespaceGroup
  autocmd!
  autocmd BufWritePre * %s/\s\+$//e
augroup END

" Indentation settings for using 4 spaces instead of tabs.
set softtabstop=2
set shiftwidth=2
set expandtab

