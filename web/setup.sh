#!/bin/bash

prerequisites="node npm"
node_modules="connect express socket.io"

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
cleanup () {
  exit 1;
}
trap cleanup SIGTERM SIGINT

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
