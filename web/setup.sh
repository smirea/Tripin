#!/bin/bash

prerequisites="node npm";
node_modules="connect express socket.io orm sqlite3 fbgraph node-inspector";
# requires sudo
global_node_modules="node-inspector";

cleanup () {
  exit 1;
}
trap cleanup SIGTERM SIGINT

if [ ${#global_node_modules[@]} -gt 0 ]; then
  if [[ $UID != 0 ]]; then
    echo "Please run this script with sudo:";
    echo "sudo $0 $*";
    exit 1;
  fi
fi

fail () {
  str=${1:-"Something went wrong"};
  code=${2:-1};
  echo $str;
  exit $code;
}

# check for prerequisites
script_fails=();
for name in $prerequisites; do
  echo -n " >> Checking for '$name': ";
  if type "$name" > /dev/null 2>&1; then
    echo "yes";
  else
    echo "no";
    script_fails+=("$name");
  fi
done

# attempt to install missing prerequisites
if [ ${#script_fails[@]} -gt 0 ]; then
  echo " >> Missing: $script_fails";
  if [ `uname` == "Darwin" ]; then
    if type brew > /dev/null 2>&1; then
      for name in $script_fails; do
        echo ;
        echo " >> Attempting brew install '$name' with Homebrew:";
        brew install "$name";
        if [ $? != 0 ]; then
          fail " >> FAILED to install '$name'";
        fi
      done
    else
      fail " >> Homebrew not found. Either manually install and re-run this script or install the missing prerequisites manually";
    fi;
  else
    fail " >> Don't know what to do on your OS.";
  fi
fi

# install node modules with npm
npm_fails=();
for name in $node_modules; do
  echo ;
  echo " >> Installing: '$name'";
  npm install "$name";
  if [ $? != 0 ]; then
    npm_fails+=("$name");
  fi
done

if [ ${#npm_fails[@]} -gt 0 ]; then
  echo
  fail " >> Failed to install the following npm packages: $npm_fails";
fi

# install global node modules with sudo npm -g
global_npm_fails=();
for name in $global_node_modules; do
  echo ;
  echo " >> Globally Installing: '$name'";
  sudo npm -g install "$name";
  if [ $? != 0 ]; then
    global_npm_fails+=("$name");
  fi
done

if [ ${#global_npm_fails[@]} -gt 0 ]; then
  echo
  fail " >> Failed to globally install the following npm packages: $global_npm_fails";
fi

echo "";
echo "DONE!";
