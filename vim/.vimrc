" Run Pathogen (vim package manager)
execute pathogen#infect()

" TODOS {{{
" configure vim-fugitive
" https://github.com/sjl/gundo.vim.git
" https://dougblack.io/words/a-good-vimrc.html Read section on backups, tmux, autogroups, and custom functions
" YouCompleteMe?
" unimpaired.vim
" }}}

" Leaders {{{
" Map space to leader
let mapleader = " "

" Make space leader behave the same as other keys would
nnoremap <Space> <nop>

" highlight last inserted text
nnoremap <leader>v `[v`]

" turn off search highlight
nnoremap <leader>n :noh<cr>

" Fix linting errors
nnoremap <leader>f :ALEFix<cr>

" Custom mapping for vim.switch
nnoremap <leader>s :Switch<cr>
"}}}

" MISC {{{
" Work with crontabs
au BufNewFile,BufRead crontab.* set nobackup | set nowritebackup

" Use the clipboard as the default register
set clipboard=unnamed "

" Configure backspacing to work 'normally'
set backspace=indent,eol,start

" Delay after typing stops before checking again (used by gitgutter).
" Can cause issues under 1000ms
set updatetime=250

" Trying to escape escape delays
set noesckeys
set timeout timeoutlen=1000 ttimeoutlen=100
" }}}

" Ale {{{
let g:ale_fixers = { 'javascript': ['eslint', 'prettier-eslint'] }
" }}}

" HardTime {{{
let g:hardtime_default_on = 0
let g:hardtime_timeout = 2000
" }}}

" CtrlP {{{
" Ignore files & folders
let g:ctrlp_custom_ignore = 'node_modules\|DS_Store\|git\|dist\|coverage'

" Display hidden files
let g:ctrlp_show_hidden = 1
" }}}

" Git Gutter {{{
" Don't create any key mappings
let g:gitgutter_map_keys = 0
" }}}

" Colors {{{
" enable syntax processing
if !exists("g:syntax_on")
    syntax enable
endif

" Setup a color theme
set background=dark
colorscheme solarized
" }}}

" Spaces and Tabs {{{
" Remove trailing whitespace on save
autocmd BufWritePre * %s/\s\+$//e

" New lines start in better places
set autoindent
set smartindent

" Change number of spaces when indenting
set shiftwidth=2

" number of visual spaces per TAB
set tabstop=2

" number of spaces in tab when editing
set softtabstop=2

" tabs are spaces
set expandtab
" }}}

" UI Config {{{
" set lazyredraw          " redraw only when we need to.
" set showcmd             " show command in bottom bar

" Only highlight current line for current window
autocmd WinEnter,FocusGained * setlocal cursorline
autocmd WinLeave,FocusLost   * setlocal nocursorline

" Disable mouse
set mouse-=a

filetype plugin indent on " load filetype-specific indent files

" Turn on line numbers
" set number
set relativenumber

" highlight matching [{()}]
set showmatch

" wildmenu (visual autocomplete for command menu)
set wildmenu
set wildignorecase
set completeopt+=longest
set wildmode=longest:full,full
" }}}

" Searching {{{
set incsearch           " search as characters are entered
set hlsearch            " highlight matches
" }}}

" Folding {{{
set foldenable          " enable folding
set foldlevelstart=10   " open most folds by default
set foldnestmax=10      " 10 nested fold max
set foldmethod=indent   " fold based on indent level
" }}}

" Movement {{{
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

" Javascript {{{
let g:javascript_plugin_jsdoc = 1
" }}}

" vim:foldmethod=marker:foldlevel=0
