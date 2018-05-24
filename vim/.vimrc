" Run Pathogen (vim package manager)
execute pathogen#infect()

" Set up folding based on markers in the file. `za` toggles folds
" vim:foldmethod=marker:foldlevel=0

" TODOS {{{
" https://github.com/rking/ag.vim/issues/124#issuecomment-227038003
" https://github.com/sjl/gundo.vim.git
" https://dougblack.io/words/a-good-vimrc.html Read section on backups, tmux, autogroups, and custom functions
" YouCompleteMe?
" unimpaired.vim
" https://github.com/skywind3000/asyncrun.vim
" https://github.com/tpope/vim-abolish
" https://github.com/skwp/dotfiles/blob/master/vimrc
" https://medium.com/@lah.data/and-five-years-later-9db30e8c0ae3
" https://github.com/liangxianzhe/oh-my-vim
" }}}

" Plugin Config {{{
" Ale {{{
" Set up auto fixers
let g:ale_fixers = { 'javascript': ['eslint', 'prettier-eslint'] }

" Don't run linters on opening a file
let g:ale_lint_on_enter = 0

" Disable Ale by default
let g:ale_enabled = 0

" GitGutter has gutter enabled which makes this option unnecessary
" Keep sign column open all the time so changes are less jarring
" let g:ale_sign_column_always = 1
" }}}

" CtrlP {{{
" Ignore files & folders
let g:ctrlp_custom_ignore = 'node_modules\|DS_Store\|git\|dist'

" Display hidden files
let g:ctrlp_show_hidden = 1
" }}}

" Git Gutter {{{
" Don't create any key mappings
let g:gitgutter_map_keys = 0

" Keep gutter open
if exists('&signcolumn')  " Vim 7.4.2201
  set signcolumn=yes
else
  let g:gitgutter_sign_column_always = 1
endif
" }}}

" HardTime {{{
let g:hardtime_default_on = 1
let g:hardtime_timeout = 2000
" }}}

" Javascript {{{
" let g:javascript_plugin_jsdoc = 0
let g:javascript_plugin_flow = 1
" }}}

" LightLine {{{
" Always show statusline
set laststatus=2
"
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
\     'time': 'PrintTime'
\   },
\ }

" Function used for printing relative file path
function! PrintFilePath()
  return fnamemodify(expand("%"), ":~:.")
endfunction
" }}}

" NERDTree {{{
" Automatically delete the buffer of the file you just deleted with NerdTree:
let NERDTreeAutoDeleteBuffer = 1

" Toggle visibility of hidden files using i and I
let NERDTreeShowHidden=1

" Don't open NERDTree by default
let g:nerdtree_tabs_open_on_gui_startup=0

" Close tree once file is selected
let NERDTreeQuitOnOpen = 1

" Toggle Nerd Tree with control + b
nnoremap <c-b> :NERDTreeToggle<CR>
" }}}
" }}}

" UI Config {{{
" Colors {{{
" enable syntax processing
if !exists("g:syntax_on")
    syntax enable
endif

" Setup a color theme
set background=dark
colorscheme solarized
" }}}

" Folding {{{
" enable folding
set foldenable

" open most folds by default
set foldlevelstart=10

" 10 nested fold max
set foldnestmax=10

" fold based on indent level
set foldmethod=indent
" }}}

" Wildmenu {{{
" configure visual autocomplete for command menu
set wildmenu
set wildignorecase
set completeopt+=longest
set wildmode=longest:full,full
" }}}

" Cursor {{{
" Disable mouse
set mouse-=a

" Disable cursor blink
set guicursor=a:blinkon0

" Only highlight current line for current window
setlocal cursorline
autocmd WinEnter,FocusGained * setlocal cursorline
autocmd WinLeave,FocusLost   * setlocal nocursorline
" }}}

" MISC {{{
" redraw only when we need to.
set lazyredraw

"Wrap lines at words when possible
set linebreak

" show command in bottom bar
set showcmd

" load filetype-specific indent files
filetype plugin indent on

" Turn on line numbers
" set number
set relativenumber

" highlight matching [{()}]
set showmatch
" }}}
" }}}

" General Config {{{
" Store lots of :cmdline history
set history=1000

" No sounds
set visualbell

" Reload files changed outside vim
set autoread

" Work with crontabs
au BufNewFile,BufRead crontab.* set nobackup | set nowritebackup

" Use the clipboard as the default register
set clipboard^=unnamed

" Configure backspacing to work 'normally'
set backspace=indent,eol,start

" Delay after typing stops before checking again (used by gitgutter).
" Can cause issues under 1000ms
set updatetime=250

" Remove escape delays (This breaks arrow keys in insert mode)
set noesckeys
set timeout timeoutlen=1000 ttimeoutlen=100
" }}}

" Leader Mappings {{{
" Map space to leader
let mapleader = " "

" Make space leader behave the same as other keys would
nnoremap <Space> <nop>

" highlight last inserted text
nnoremap <leader>v `[v`]

" turn off search highlight
nnoremap <leader>n :noh<cr>

" Easily toggle Hard Time
nnoremap <leader>h :HardTimeToggle<cr>

" Fix linting errors
nnoremap <leader>f :ALEFix<cr>

" Toggle linting with a (for ale)
nnoremap <leader>a :ALEToggle<cr>

" Custom mapping for vim.switch
nnoremap <leader>s :Switch<cr>

" Apply last operation to a range of lines
vnoremap <leader>. : normal .<cr>

" Clear CtrlP Caches
nnoremap <leader>p :CtrlPClearAllCaches<cr>

"}}}

" Spaces and Tabs {{{
" Remove trailing whitespace on save
autocmd BufWritePre * %s/\s\+$//e

" New lines start in better places
set autoindent

" Change number of spaces when indenting
set shiftwidth=2

" number of visual spaces per TAB
set tabstop=2

" tabs are spaces
set expandtab
" }}}

" Movement & Searching {{{
" search as characters are entered
set incsearch

" highlight matches
set hlsearch

"Start scrolling when we're 10 lines away
set scrolloff=10

" Don't skip visual lines (wrapped text)
nnoremap j gj
nnoremap k gk
xnoremap j gj
xnoremap k gk

" Easier split navigation
nmap gh <C-w>h
nmap gj <C-w>j
nmap gk <C-w>k
nmap gl <C-w>l
" }}}

" Fix Cursor rendering issue
set ttyfast
set norelativenumber
set number
set nocursorline
set noshowcmd
