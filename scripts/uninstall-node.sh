
cd /usr/local/lib
rm -rf node 
rm -rf node_modules


cd /usr/local/include
rm -rf node
rm -rf node_modules


cd /usr/local/bin
rm node
rm node-debug
rm node-gyp

# cd ~
# rm .npmrc 

cd ~
rm -rf .npm

cd ~
rm .npm 
rm .node-gyp
rm -rf .node_repl_history

cd /usr/local/share/man/man1/
rm node* 

cd /usr/local/share/man/man1/
rm npm* 

cd /usr/local/lib/dtrace/
rm node.d 

cd /opt/local/bin/
rm -rf node

cd /opt/local/include/
rm node 

cd /opt/local/lib/
rm -rf node_modules 

cd /usr/local/share/doc/
rm node 

cd /usr/local/share/systemtap/tapset/
rm node.stp 
