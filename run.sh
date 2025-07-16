#! /bin/bash

# this script will look for inverstigator-tool in the ~ directory
# if exists:
# - cd to that directory
# - git pull
# - run npm install
# - run npm start
# if not exists:
# - clone the repository
# - cd to the directory
# - run npm install
# - run npm start
# arg:
# aws profile name

AWS_PROFILE=$1

if [ -d "$HOME/inverstigator-tool" ]; then
    echo "Updating inverstigator-tool"
    cd "$HOME/inverstigator-tool"
    git pull
else
    echo "Installing inverstigator-tool"
    cd ~
    git clone https://github.com/jitsecurity-bandit/inverstigator-tool.git
    echo "Installing dependencies"
    cd inverstigator-tool
fi
npm install
echo "Starting inverstigator-tool"
aws-vault exec $AWS_PROFILE -- npm run start
