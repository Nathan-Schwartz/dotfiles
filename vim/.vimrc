" Run Pathogen (vim package manager)
execute pathogen#infect()

" TODOS {{{
" https://github.com/sjl/gundo.vim.git
" https://github.com/Xuyuanp/nerdtree-git-plugin
" https://dougblack.io/words/a-good-vimrc.html
" Read section on backups, tmux, autogroups, and custom functions
" configure gitgutter
" YouCompleteMe?
" unimpaired.vim
" Syntastic
" }}}

" MISC {{{
set clipboard=unnamed
set backspace=indent,eol,start " Allow backspacing over new lines and stuff
set updatetime=250
" }}}

" HardTime {{{
let g:hardtime_default_on = 0
let g:hardtime_timeout = 2000
" }}}

" CtrlP {{{
let g:ctrlp_show_hidden = 1
" }}}

" Git Gutter {{{
let g:gitgutter_realtime = 0
let g:gitgutter_eager = 0
" }}}

" Syntastic {{{
let g:syntastic_javascript_checkers = ['flow', 'eslint']
set statusline+=%#warningmsg#
set statusline+=%{SyntasticStatuslineFlag()}
set statusline+=%*

let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 1
let g:syntastic_check_on_wq = 0
" }}}

" Colors {{{
" enable syntax processing
if !exists("g:syntax_on")
    syntax enable
endif

set background=dark
colorscheme solarized
" }}}

" Spaces and Tabs {{{
set smartindent
set shiftwidth=2
set tabstop=2       " number of visual spaces per TAB
set softtabstop=2   " number of spaces in tab when editing
set expandtab       " tabs are spaces
" }}}

" UI Config {{{
" set lazyredraw          " redraw only when we need to.
" set showcmd             " show command in bottom bar
set cursorline          " highlight current line

" Disable mouse
set mouse-=a

filetype plugin indent on " load filetype-specific indent files

" Turn on line numbers
" set number
set relativenumber

set showmatch           " highlight matching [{()}]

" wildmenu (visual autocomplete for command menu)
set wildmenu
set wildignorecase
set completeopt+=longest
set wildmode=longest:full,full
" }}}

" Searching {{{
set incsearch           " search as characters are entered
set hlsearch            " highlight matches
" turn off search highlight
"Vim will keep highlighted matches from searches until you either run a new one or manually stop highlighting the old search with :nohlsearch. I find myself running this all the time so I've mapped 
" nnoremap <leader><space> :nohlsearch<CR>
" nnoremap <esc> :noh<return><esc>
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

" Move fast with shift
nmap <c-j> 3j
nmap <c-k> 3k
nmap <c-h> 3h
nmap <c-l> 3l

" Easier split navigation
nmap gh <C-w>h
nmap gj <C-w>j
nmap gk <C-w>k
nmap gl <C-w>l

" highlight last inserted text
" nnoremap gV `[v`]
" }}}

" NERDTree {{{

" Automatically delete the buffer of the file you just deleted with NerdTree:
let NERDTreeAutoDeleteBuffer = 1

" Toggle visibility of hidden files using i and I
let NERDTreeShowHidden=1

" Close tree once file is selected
let NERDTreeQuitOnOpen = 1

" Toggle Nerd Tree with control + b
nnoremap <c-b> :NERDTreeToggle<CR>
" }}}

" switch.vim {{{
nnoremap - :Switch<cr> 
" }}}

" Javascript {{{
let g:javascript_plugin_jsdoc = 1
let g:javascript_plugin_flow = 1

let g:flow#enable = 0
" }}}

" vim:foldmethod=marker:foldlevel=0

